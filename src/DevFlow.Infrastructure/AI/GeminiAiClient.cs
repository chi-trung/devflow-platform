using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
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

    public async Task<string?> PlanTaskAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return null;
        }

        // Assemble the generateContent URL. Default to the Google Generative
        // Language API; a custom BaseUrl (LiteLLM-style Gemini gateway) can
        // override it, but the model name is still appended the same way.
        var baseUrl = string.IsNullOrWhiteSpace(_options.BaseUrl)
            ? DefaultBaseUrl
            : _options.BaseUrl.TrimEnd('/');
        var url = $"{baseUrl}/models/{_options.Model}:generateContent";

        var payload = new
        {
            contents = new[]
            {
                new { role = "user", parts = new[] { new { text = systemPrompt + "\n\n" + userContext } } },
            },
            generationConfig = new
            {
                temperature = 0.3,
                maxOutputTokens = _options.MaxTokens,
                responseMimeType = "application/json",
            },
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, url) { Content = content };
        // Gemini supports both ?key= and the X-goog-api-key header; the header
        // is the documented best practice and avoids leaking the key in URLs.
        request.Headers.Add("X-goog-api-key", _options.ApiKey);

        try
        {
            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException($"AI API error {(int)response.StatusCode}: {body}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            using var document = JsonDocument.Parse(responseBody);
            if (document.RootElement.TryGetProperty("candidates", out var candidates) &&
                candidates.GetArrayLength() > 0 &&
                candidates[0].TryGetProperty("content", out var candidateContent) &&
                candidateContent.TryGetProperty("parts", out var parts) &&
                parts.GetArrayLength() > 0 &&
                parts[0].TryGetProperty("text", out var text))
            {
                return text.GetString();
            }

            return null;
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException($"AI request failed: {ex.Message}", ex);
        }
    }
}
