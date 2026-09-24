using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Fallback when no Ai:ApiKey is configured. Always returns null so ingestion
/// stores chunks without vectors and retrieval falls back to weight-ordered
/// full entries — same fail-closed shape as <see cref="NoOpAiClient"/>.
/// </summary>
public sealed class NoOpEmbeddingClient : IEmbeddingClient
{
    public Task<float[]?> EmbedAsync(string text, CancellationToken cancellationToken = default) =>
        Task.FromResult<float[]?>(null);

    public Task<IReadOnlyList<float[]?>?> EmbedBatchAsync(
        IReadOnlyList<string> texts,
        CancellationToken cancellationToken = default) =>
        Task.FromResult<IReadOnlyList<float[]?>?>(null);
}
