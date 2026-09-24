using System.Text;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Outbox-driven chunk + embed pipeline. Loads the entry, builds a
/// self-contained source (title + tags + body), chunks it, batch-embeds, and
/// swaps the entry's chunks in one SaveChanges. Embedding failure (no key,
/// provider error) still stores the chunks with null vectors so retrieval's
/// weight-based fallback works; a later re-embed pass can fill vectors in.
/// </summary>
public sealed class KnowledgeIngestionService(
    IKnowledgeRepository knowledgeRepository,
    IContentChunker contentChunker,
    IEmbeddingClient embeddingClient,
    IUnitOfWork unitOfWork,
    ILogger<KnowledgeIngestionService> logger) : IKnowledgeIngestionService
{
    public async Task ReingestEntryAsync(Guid knowledgeEntryId, CancellationToken cancellationToken = default)
    {
        var entry = await knowledgeRepository.GetByIdAsync(knowledgeEntryId, cancellationToken);

        if (entry is null)
        {
            // Deleted between enqueue and process — clear any leftover chunks
            // so a race cannot leave orphans.
            await knowledgeRepository.ReplaceChunksAsync(knowledgeEntryId, [], cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
            return;
        }

        var source = BuildSource(entry);
        var texts = contentChunker.Chunk(source);

        // Prefix every chunk with the entry title so a mid-body slice still
        // carries its heading for the prompt (and for citation).
        var contents = texts
            .Select(chunk =>
                string.IsNullOrWhiteSpace(chunk) ? entry.Title :
                chunk.StartsWith(entry.Title, StringComparison.Ordinal) ? chunk : $"{entry.Title}\n{chunk}")
            .ToList();

        float[]?[]? vectors = null;
        try
        {
            vectors = (await embeddingClient.EmbedBatchAsync(contents, cancellationToken))?.ToArray();
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Store unembedded chunks; retrieval falls back by weight.
            logger.LogWarning(ex, "Embedding failed for knowledge entry {EntryId}", knowledgeEntryId);
        }

        var chunks = new List<Domain.Entities.KnowledgeChunk>(contents.Count);
        for (var i = 0; i < contents.Count; i++)
        {
            var chunk = Domain.Entities.KnowledgeChunk.Create(
                entry.Id, entry.ProjectId, i, contents[i]);

            if (vectors is not null && i < vectors.Length && vectors[i] is { Length: > 0 } vector)
            {
                chunk.SetEmbedding(vector);
            }

            chunks.Add(chunk);
        }

        await knowledgeRepository.ReplaceChunksAsync(entry.Id, chunks, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }

    private static string BuildSource(Domain.Entities.KnowledgeEntry entry)
    {
        var builder = new StringBuilder();
        builder.Append(entry.Title);
        if (!string.IsNullOrWhiteSpace(entry.Tags))
        {
            builder.Append('\n').Append("Tags: ").Append(entry.Tags);
        }

        if (!string.IsNullOrWhiteSpace(entry.Body))
        {
            builder.Append("\n\n").Append(entry.Body);
        }

        return builder.ToString();
    }
}
