using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Google Gemini client (Generative Language API). Gemini authenticates via a
/// <c>?key=</c> query parameter on the URL (not a Bearer header) and uses a
/// different request shape (<c>contents</c>/<c>parts</c>, not <c>messages</c>),
/// so this client is separate from <see cref="OpenAiAiClient"/>. It still
/// honors <see cref="IAiClient.PlanTaskAsync"/> and returns the model's raw
/// JSON plan text, so the CQRS pipeline treats it identically to OpenAI.
/// </summary>
public sealed class GeminiAiClient : IAiClient
{
    private const string DefaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";

    /// <summary>
    /// Alternative models tried when the configured model returns HTTP 429/503
    /// ("model currently experiencing high demand"). Google's flash tier has
    /// been overloaded intermittently; the sibling flash model usually still
    /// accepts requests, so we retry the primary model a few times with
    /// backoff, then fall through to these. These are real, stable model IDs
    /// that accept the v1beta generateContent API.
    /// </summary>
    private static readonly string[] FallbackModels =
        ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];

    /// <summary>Per-request budget. A plan (4000 tokens) needs ~16s, so 60s is safe.</summary>
    private static readonly TimeSpan PlanTimeout = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Action responses carry one JSON object per requested change (create task,
    /// set deadline, assign...). A prompt asking for a batch of changes can
    /// easily exceed 1000 tokens once each action has a title + description, so
    /// we give the execute endpoint the same generous ceiling as planning. The
    /// shared timeout stays modest — 60s covers a slow model without reading as
    /// frozen in the assistant.
    /// </summary>
    private static readonly TimeSpan ExecuteTimeout = TimeSpan.FromSeconds(60);

    /// <summary>
    /// Per-request budget. One hung HTTP call must not be able to consume the
    /// whole shared timeout (below); a request that exceeds its own budget is
    /// abandoned and the next model/attempt takes over. 35s is generous enough
    /// for a large batch (15+ actions, ~16s of generation) but bounds a single
    /// stuck call well inside the shared budget.
    /// </summary>
    private static readonly TimeSpan RequestTimeout = TimeSpan.FromSeconds(35);

    /// <summary>Number of attempts per model before moving to the next fallback.</summary>
    private const int MaxAttemptsPerModel = 2;

    private readonly HttpClient _httpClient;
    private readonly AiOptions _options;

    public GeminiAiClient(
        HttpClient httpClient,
        IOptions<AiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ApiKey) &&
        !string.IsNullOrWhiteSpace(_options.Model);

    public Task<string?> PlanTaskAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default) =>
        GenerateContentAsync(systemPrompt, userContext, _options.MaxTokens, PlanTimeout, cancellationToken);

    public Task<string?> ExecuteActionAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default) =>
GenerateContentAsync(systemPrompt, userContext, _options.MaxTokens, ExecuteTimeout, cancellationToken);

    /// <summary>
    /// Sends the prompt to the configured model, retrying HTTP 429/503 with
    /// exponential backoff and falling back to sibling models when the primary
    /// one is overloaded. All retries share a single timeout budget so a
    /// degraded model cannot hang the request for minutes.
    /// </summary>
    private async Task<string?> GenerateContentAsync(
        string systemPrompt,
        string userContext,
        int maxOutputTokens,
        TimeSpan timeout,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            return null;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(timeout);

        // Assemble the generateContent URL. Default to the Google Generative
        // Language API; a custom BaseUrl (LiteLLM-style Gemini gateway) can
        // override it, but the model name is still appended the same way.
        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? DefaultBaseUrl
            : _options.BaseUrl.TrimEnd('/');

        // Try the configured model first, then any fallback that is different.
        var models = new List<string> { _options.Model };
        foreach (var fallback in FallbackModels)
        {
            if (!models.Contains(fallback, StringComparer.OrdinalIgnoreCase))
            {
                models.Add(fallback);
            }
        }

        var totalAttempts = models.Count * MaxAttemptsPerModel;
        for (var attempt = 0; attempt < totalAttempts; attempt++)
        {
            var model = models[attempt / MaxAttemptsPerModel];

            if (attempt > 0)
            {
                // Exponential backoff: 1s, 2s, 3s... capped so the total stays
                // well inside the shared timeout budget and leaves room for the
                // fallback models to actually run.
                var backoffSeconds = Math.Min(3, Math.Pow(2, attempt - 1));
                await Task.Delay(TimeSpan.FromSeconds(backoffSeconds), cts.Token);
            }

            try
            {
                // Each request gets its own strict budget so a hung (not just
                // slow) model is abandoned quickly and the next attempt takes
                // over instead of eating the entire shared timeout.
                using var requestCts = CancellationTokenSource.CreateLinkedTokenSource(cts.Token);
                requestCts.CancelAfter(RequestTimeout);
                return await SendGenerateContentAsync(
                    baseUrl, model, systemPrompt, userContext, maxOutputTokens, requestCts.Token);
            }
            catch (OperationCanceledException) when (!cts.IsCancellationRequested)
            {
                // Per-request budget hit — the model hung. Treat as transient and
                // move to the next attempt; the shared budget is still intact.
            }
            catch (GeminiOverloadedException)
            {
                // 429/503 — transient overload. Retry, then move to the next model.
            }
            // AiResponseTruncatedException is intentionally NOT caught here: a
            // truncated response means the model hit the same output-token
            // ceiling we gave it, so retrying the identical request (same
            // maxOutputTokens) against a sibling model will truncate again.
            // Let it propagate so the caller can re-prompt with a smaller scope
            // instead of wasting the remaining attempts.
        }

        throw new InvalidOperationException(
            $"AI API error 503: The model is currently experiencing high demand. Please try again later.");
    }

    private async Task<string?> SendGenerateContentAsync(
        string baseUrl,
        string model,
        string systemPrompt,
        string userContext,
        int maxOutputTokens,
        CancellationToken cancellationToken)
    {
        var url = $"{baseUrl}/models/{model}:generateContent";

        var payload = new
        {
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = systemPrompt + "\n\n" + userContext } } },
            },
            generationConfig = new
            {
                temperature = 0.3,
                maxOutputTokens,
                responseMimeType = "application/json",
            },
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        // Gemini supports both ?key= and the X-goog-api-key header; the header
        // is the documented best practice and avoids leaking the key in URLs.
        request.Headers.Add("X-goog-api-key", _options.ApiKey);

        var response = await _httpClient.SendAsync(request, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            if ((int)response.StatusCode == 429 || (int)response.StatusCode == 503)
            {
                // Overload / rate-limit — the caller retries with backoff and
                // eventually a fallback model.
                throw new GeminiOverloadedException($"AI API error {(int)response.StatusCode}: {body}");
            }

            if ((int)response.StatusCode == 404 || (int)response.StatusCode == 400)
            {
                // Model not found / invalid request — the configured or fallback
                // model ID may have been deprecated by Google. This is not a
                // real user error: move to the next model in the fallback chain
                // rather than surfacing a confusing 503/500.
                throw new GeminiOverloadedException($"AI API error {(int)response.StatusCode}: {body}");
            }

            // Other errors (auth 401, ...) are not transient — surface them
            // immediately like before.
            throw new InvalidOperationException($"AI API error {(int)response.StatusCode}: {body}");
        }

        var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

        using var document = JsonDocument.Parse(responseBody);
        if (!document.RootElement.TryGetProperty("candidates", out var candidates) ||
            candidates.GetArrayLength() == 0 ||
            !candidates[0].TryGetProperty("content", out var candidateContent) ||
            !candidateContent.TryGetProperty("parts", out var parts) ||
            parts.GetArrayLength() == 0 ||
            !parts[0].TryGetProperty("text", out var text))
        {
            return null;
        }

        var raw = text.GetString();
        if (raw is null)
        {
            return null;
        }

        // MAX_TOKENS means the model ran out of output budget mid-response, so
        // the JSON is guaranteed truncated. Rather than hand the caller a broken
        // payload that parses to zero actions, throw a retryable signal. If the
        // text happens to parse cleanly anyway (rare — the truncation cut at a
        // valid boundary), let it through.
        if (candidates[0].TryGetProperty("finishReason", out var finishReason) &&
            finishReason.GetString() == "MAX_TOKENS")
        {
            try
            {
                using (JsonDocument.Parse(raw))
                {
                }
            }
            catch (JsonException)
            {
                throw new AiResponseTruncatedException(
                    "The model ran out of output tokens and returned a truncated response.");
            }
        }

        return raw;
    }

    /// <summary>Thrown when Gemini returns 429/503 (transient overload).</summary>
    private sealed class GeminiOverloadedException(string message) : Exception(message);
}
