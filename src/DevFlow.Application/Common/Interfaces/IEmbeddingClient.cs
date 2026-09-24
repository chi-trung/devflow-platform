namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Provider-agnostic embedding client. Returns null when no API key is
/// configured (mirrors <see cref="IAiClient"/>'s null-on-unconfigured
/// contract) so ingestion can store chunks without vectors and retrieval
/// falls back to weight-ordered knowledge.
/// </summary>
public interface IEmbeddingClient
{
    /// <summary>Embeds a single text. Null on unconfigured / provider failure.</summary>
    Task<float[]?> EmbedAsync(string text, CancellationToken cancellationToken = default);

    /// <summary>
    /// Embeds a batch. Parallel position — each element is the vector for the
    /// matching input, or null when that item failed. Null array on total
    /// failure (unconfigured / HTTP error).
    /// </summary>
    Task<IReadOnlyList<float[]?>?> EmbedBatchAsync(
        IReadOnlyList<string> texts,
        CancellationToken cancellationToken = default);
}
