using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Default re-ranker: identity. Registered while Ai:EnableRerank is false
/// (the shipping default) so cosine order from vector search is final. A real
/// cross-encoder can replace this without touching retrieval call sites.
/// </summary>
public sealed class NoOpReranker : IReranker
{
    public Task<IReadOnlyList<KnowledgeChunkHit>> RerankAsync(
        string query,
        IReadOnlyList<KnowledgeChunkHit> candidates,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(candidates);
}
