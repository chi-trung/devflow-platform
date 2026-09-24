using DevFlow.Application.Common.Models;

namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Optional second-stage re-ranker over vector-search candidates. Default
/// registration is <c>NoOpReranker</c> with <c>Ai:EnableRerank=false</c> —
/// the pipeline works with cosine order alone; a real cross-encoder can be
/// swapped in later without touching call sites.
/// </summary>
public interface IReranker
{
    Task<IReadOnlyList<KnowledgeChunkHit>> RerankAsync(
        string query,
        IReadOnlyList<KnowledgeChunkHit> candidates,
        CancellationToken cancellationToken = default);
}
