using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// OpenAI-compatible embeddings client (POST /embeddings). Passes
/// <c>dimensions</c> so text-embedding-3-small truncates to the migration's
/// vector(768) width — one column serves both providers. Works against any
/// OpenAI-compatible gateway that exposes the embeddings endpoint.
/// </summary>
public sealed class OpenAiEmbeddingClient : IEmbeddingClient
{
    private const string DefaultBaseUrl = "https://api.openai.com/v1";
    private const string DefaultModel = "text-embedding-3-small";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private readonly HttpClient _httpClient;
    private readonly AiOptions _options;

    public OpenAiEmbeddingClient(HttpClient httpClient, IOptions<AiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    private bool IsConfigured => !string.IsNullOrWhiteSpace(_options.ApiKey);

    private string BaseUrl =>
        string.IsNullOrWhiteSpace(_options.BaseUrl) ? DefaultBaseUrl : _options.BaseUrl.TrimEnd('/');

    private string Model =>
        string.IsNullOrWhiteSpace(_options.EmbeddingModel) ? DefaultModel : _options.EmbeddingModel;

    public async Task<float[]?> EmbedAsync(string text, CancellationToken cancellationToken = default)
    {
        var batch = await EmbedBatchAsync([text], cancellationToken);
        return batch is { Count: > 0 } ? batch[0] : null;
    }

    public async Task<IReadOnlyList<float[]?>?> EmbedBatchAsync(
        IReadOnlyList<string> texts,
        CancellationToken cancellationToken = default)
    {
        if (!IsConfigured || texts.Count == 0)
        {
            return null;
        }

        using var cts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        cts.CancelAfter(Timeout);

        var payload = new Dictionary<string, object>
        {
            ["model"] = Model,
            ["input"] = texts,
        };

        // v3-small defaults to 1536; force the shared 768 column width.
        // Older models (ada-002) reject the field, so only send it for v3.
        if (_options.EmbeddingDimensions > 0 &&
            Model.Contains("text-embedding-3", StringComparison.OrdinalIgnoreCase))
        {
            payload["dimensions"] = _options.EmbeddingDimensions;
        }

        var json = JsonSerializer.Serialize(payload);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"{BaseUrl}/embeddings")
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json"),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        try
        {
            using var response = await _httpClient.SendAsync(request, cts.Token);
            if (!response.IsSuccessStatusCode)
            {
                var body = await response.Content.ReadAsStringAsync(cts.Token);
                throw new InvalidOperationException($"Embedding API error {(int)response.StatusCode}: {body}");
            }

            var responseBody = await response.Content.ReadAsStringAsync(cts.Token);
            using var document = JsonDocument.Parse(responseBody);

            if (!document.RootElement.TryGetProperty("data", out var data) ||
                data.GetArrayLength() != texts.Count)
            {
                return null;
            }

            var results = new float[]?[texts.Count];
            for (var i = 0; i < texts.Count; i++)
            {
                var item = data[i];
                if (item.TryGetProperty("embedding", out var embedding) &&
                    embedding.ValueKind == JsonValueKind.Array)
                {
                    var values = new float[embedding.GetArrayLength()];
                    for (var j = 0; j < values.Length; j++)
                    {
                        values[j] = embedding[j].GetSingle();
                    }

                    results[i] = values;
                }
            }

            return results;
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw new InvalidOperationException("Embedding API request timed out.");
        }
        catch (JsonException ex)
        {
            throw new InvalidOperationException($"Embedding API returned unreadable JSON: {ex.Message}", ex);
        }
    }
}
