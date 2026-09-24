using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IKnowledgeRepository
{
    Task AddAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default);

    Task<KnowledgeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<KnowledgeEntry>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<KnowledgeEntry>> GetForTaskAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task RemoveAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default);

    /// <summary>
    /// Replaces every chunk for <paramref name="knowledgeEntryId"/> with
    /// <paramref name="chunks"/>. Chunks may have null embeddings (no API key).
    /// </summary>
    Task ReplaceChunksAsync(
        Guid knowledgeEntryId,
        IReadOnlyList<KnowledgeChunk> chunks,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Cosine vector search over embedded chunks for one project, restricted
    /// to live statuses (Draft/Proposed/Accepted) and weight ≥ 0.1. Returns
    /// hits ordered nearest-first. InMemory (no pgvector) computes cosine in
    /// process so integration tests without Docker still exercise the path.
    /// </summary>
    Task<IReadOnlyList<KnowledgeChunkHit>> SearchChunksForProjectAsync(
        Guid projectId,
        float[] queryEmbedding,
        int topK,
        CancellationToken cancellationToken = default);
}
