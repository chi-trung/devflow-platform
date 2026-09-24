using DevFlow.Application.Common.Models;

namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// RAG retrieval for the AI planner / assistant: embed the query, cosine
/// search project-scoped chunks, optionally re-rank, then clip to a character
/// budget for prompt stuffing. Falls back to weight-ordered full entries when
/// embedding or vector search is unavailable (no API key, provider outage,
/// InMemory tests).
/// </summary>
public interface IKnowledgeRetrievalService
{
    Task<IReadOnlyList<KnowledgeChunkHit>> RetrieveAsync(
        Guid projectId,
        string query,
        int topK,
        int maxChars,
        CancellationToken cancellationToken = default);
}
