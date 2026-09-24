using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// RAG retrieval: embed query → cosine search (project + live status) →
/// optional re-rank → clip to character budget. Any failure (no key,
/// provider error, empty vector set) falls back to weight-ordered full
/// entries so the planner never sees a silent empty knowledge base.
/// </summary>
public sealed class KnowledgeRetrievalService(
    IKnowledgeRepository knowledgeRepository,
    IEmbeddingClient embeddingClient,
    IReranker reranker,
    IOptions<AiOptions> options,
    ILogger<KnowledgeRetrievalService> logger) : IKnowledgeRetrievalService
{
    public async Task<IReadOnlyList<KnowledgeChunkHit>> RetrieveAsync(
        Guid projectId,
        string query,
        int topK,
        int maxChars,
        CancellationToken cancellationToken = default)
    {
        var effectiveTopK = topK > 0 ? topK : options.Value.RetrieveTopK;
        var budget = maxChars > 0 ? maxChars : options.Value.KnowledgeCharBudget;

        var hits = await TryVectorSearchAsync(projectId, query, effectiveTopK, cancellationToken);

        if (hits.Count == 0)
        {
            hits = await FallbackByWeightAsync(projectId, effectiveTopK, cancellationToken);
        }

        return ClipToBudget(hits, budget);
    }

    private async Task<IReadOnlyList<KnowledgeChunkHit>> TryVectorSearchAsync(
        Guid projectId,
        string query,
        int topK,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return [];
        }

        float[]? embedding;
        try
        {
            embedding = await embeddingClient.EmbedAsync(query, cancellationToken);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogDebug(ex, "Query embedding failed; falling back to weight order");
            return [];
        }

        if (embedding is not { Length: > 0 })
        {
            return [];
        }

        try
        {
            var candidates = await knowledgeRepository.SearchChunksForProjectAsync(
                projectId, embedding, topK, cancellationToken);

            if (candidates.Count == 0)
            {
                return [];
            }

            if (options.Value.EnableRerank)
            {
                candidates = await reranker.RerankAsync(query, candidates, cancellationToken);
            }

            return candidates;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "Vector search failed for project {ProjectId}; falling back", projectId);
            return [];
        }
    }

    private async Task<IReadOnlyList<KnowledgeChunkHit>> FallbackByWeightAsync(
        Guid projectId,
        int topK,
        CancellationToken cancellationToken)
    {
        var entries = await knowledgeRepository.GetForProjectAsync(projectId, cancellationToken);

        return entries
            .Where(e => e.Status is Domain.Enums.KnowledgeStatus.Draft
                or Domain.Enums.KnowledgeStatus.Proposed
                or Domain.Enums.KnowledgeStatus.Accepted)
            .Where(e => e.Weight >= 0.1m)
            .OrderByDescending(e => e.Weight)
            .ThenByDescending(e => e.CreatedAtUtc)
            .Take(topK)
            .Select(e => new KnowledgeChunkHit(
                e.Id,
                0,
                e.Title,
                e.Body ?? string.Empty,
                e.Type,
                e.Status,
                e.Weight,
                Similarity: null))
            .ToList();
    }

    private static IReadOnlyList<KnowledgeChunkHit> ClipToBudget(
        IReadOnlyList<KnowledgeChunkHit> hits,
        int maxChars)
    {
        if (hits.Count == 0 || maxChars <= 0)
        {
            return hits;
        }

        var kept = new List<KnowledgeChunkHit>(hits.Count);
        var used = 0;

        foreach (var hit in hits)
        {
            var cost = hit.Title.Length + hit.Content.Length + 80; // header overhead
            if (kept.Count > 0 && used + cost > maxChars)
            {
                break;
            }

            kept.Add(hit);
            used += cost;

            // Always keep at least one hit even if it alone exceeds the budget.
            if (used > maxChars && kept.Count == 1)
            {
                break;
            }
        }

        return kept;
    }
}
