using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Google Gemini embeddings client (batchEmbedContents). text-embedding-004
/// always returns 768 dimensions — matches the migration's vector(768) with
/// no dimensions= parameter needed. Authenticates via x-goog-api-key like
/// <see cref="GeminiAiClient"/>.
/// </summary>
public sealed class GeminiEmbeddingClient : IEmbeddingClient
{
    private const string DefaultBaseUrl = "https://generativelanguage.googleapis.com/v1beta";
    private const string DefaultModel = "text-embedding-004";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(30);

    private readonly HttpClient _httpClient;
    private readonly AiOptions _options;

    public GeminiEmbeddingClient(HttpClient httpClient, IOptions<AiOptions> options)
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

        // batchEmbedContents caps at ~100 requests; knowledge chunks per entry
        // are far fewer, so one call is enough.
        var requests = texts.Select(text => new
        {
            model = $"models/{Model}",
            content = new { parts = new[] { new { text } } },
        });

        var payload = JsonSerializer.Serialize(new { requests });
        var url = $"{BaseUrl}/models/{Model}:batchEmbedContents";

        using var request = new HttpRequestMessage(HttpMethod.Post, url)
        {
            Content = new StringContent(payload, Encoding.UTF8, "application/json"),
        };
        request.Headers.Add("x-goog-api-key", _options.ApiKey);

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

            if (!document.RootElement.TryGetProperty("embeddings", out var embeddings) ||
                embeddings.GetArrayLength() != texts.Count)
            {
                return null;
            }

            var results = new float[]?[texts.Count];
            for (var i = 0; i < texts.Count; i++)
            {
                var item = embeddings[i];
                if (item.TryGetProperty("values", out var values) &&
                    values.ValueKind == JsonValueKind.Array)
                {
                    var vector = new float[values.GetArrayLength()];
                    for (var j = 0; j < vector.Length; j++)
                    {
                        vector[j] = values[j].GetSingle();
                    }

                    results[i] = vector;
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
