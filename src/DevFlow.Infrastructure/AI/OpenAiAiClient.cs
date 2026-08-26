using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// OpenAI-compatible chat client. Works against the OpenAI API directly, or any
/// OpenAI-compatible endpoint (LiteLLM, Ollama, vLLM, Together, ...) by pointing
/// <see cref="AiOptions.BaseUrl"/> at it. If you use Anthropic natively, add a
/// dedicated client behind <see cref="IAiClient"/> and register it based on
/// <see cref="AiOptions.Provider"/>.
/// </summary>
public sealed class OpenAiAiClient : IAiClient
{
    private readonly HttpClient _httpClient;
    private readonly AiOptions _options;

    public OpenAiAiClient(
        HttpClient httpClient,
        IOptions<AiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ApiKey) &&
        !string.IsNullOrWhiteSpace(_options.BaseUrl);

    public async Task<string?> ExecuteActionAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return null;
        }

        var payload = new
        {
            model = _options.Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userContext },
            },
            temperature = 0.3,
            max_tokens = 1000,
            response_format = new { type = "json_object" },
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_options.BaseUrl.TrimEnd('/')}/chat/completions")
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        try
        {
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            cts.CancelAfter(TimeSpan.FromSeconds(30));

            var response = await _httpClient.SendAsync(request, cts.Token);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException($"AI API error {(int)response.StatusCode}: {body}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            // Some OpenAI-compatible proxies (LiteLLM, and certain deepseek
            // gateways) append a streaming sentinel to an otherwise normal
            // non-streaming response: ...}}data: [DONE]. Strip it so the
            // payload parses as plain JSON.
            var doneMarker = responseBody.LastIndexOf("data: [DONE]", StringComparison.OrdinalIgnoreCase);
            if (doneMarker >= 0)
            {
                responseBody = responseBody[..doneMarker];
            }

            using var document = JsonDocument.Parse(responseBody.TrimEnd());
            if (document.RootElement.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("message", out var message) &&
                message.TryGetProperty("content", out var contentValue))
            {
                return contentValue.GetString();
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

    public async Task<string?> PlanTaskAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured)
        {
            return null;
        }

        var payload = new
        {
            model = _options.Model,
            messages = new[]
            {
                new { role = "system", content = systemPrompt },
                new { role = "user", content = userContext },
            },
            temperature = 0.3,
            max_tokens = _options.MaxTokens,
            response_format = new { type = "json_object" },
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(
            HttpMethod.Post,
            $"{_options.BaseUrl.TrimEnd('/')}/chat/completions")
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        try
        {
            var response = await _httpClient.SendAsync(request, cancellationToken);

            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cancellationToken);
                throw new InvalidOperationException($"AI API error {(int)response.StatusCode}: {body}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            // Some OpenAI-compatible proxies (LiteLLM, and certain deepseek
            // gateways) append a streaming sentinel to an otherwise normal
            // non-streaming response: ...}}data: [DONE]. Strip it so the
            // payload parses as plain JSON.
            var doneMarker = responseBody.LastIndexOf("data: [DONE]", StringComparison.OrdinalIgnoreCase);
            if (doneMarker >= 0)
            {
                responseBody = responseBody[..doneMarker];
            }

            using var document = JsonDocument.Parse(responseBody.TrimEnd());
            if (document.RootElement.TryGetProperty("choices", out var choices) &&
                choices.GetArrayLength() > 0 &&
                choices[0].TryGetProperty("message", out var message) &&
                message.TryGetProperty("content", out var contentValue))
            {
                return contentValue.GetString();
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
