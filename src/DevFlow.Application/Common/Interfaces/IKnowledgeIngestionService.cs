namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Chunk + embed pipeline for a KnowledgeEntry. Invoked from the outbox
/// (<c>knowledge.reembed</c>) after create/update/auto-capture so the HTTP
/// path never blocks on embedding latency. Replaces the entry's previous
/// chunks atomically; missing entry (deleted mid-flight) clears leftovers.
/// </summary>
public interface IKnowledgeIngestionService
{
    Task ReingestEntryAsync(Guid knowledgeEntryId, CancellationToken cancellationToken = default);
}
