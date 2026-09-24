using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Pgvector;
using Pgvector.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class KnowledgeRepository(DevFlowDbContext dbContext) : IKnowledgeRepository
{
    // Superseded/Deprecated drop weight to 0.05 — the threshold excludes them
    // even if status were mis-set; status filter is the primary gate.
    private const decimal MinWeight = 0.1m;

    public async Task AddAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default)
    {
        await dbContext.KnowledgeEntries.AddAsync(entry, cancellationToken);
    }

    public Task<KnowledgeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.KnowledgeEntries.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<KnowledgeEntry>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var entries = await dbContext.KnowledgeEntries
            .AsNoTracking()
            .Where(k => k.ProjectId == projectId)
            .OrderByDescending(k => k.Weight)
            .ThenByDescending(k => k.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return entries;
    }

    public async Task<IReadOnlyList<KnowledgeEntry>> GetForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        var entries = await dbContext.KnowledgeEntries
            .Where(k => k.TaskId == taskId)
            .ToListAsync(cancellationToken);

        return entries;
    }

    public Task RemoveAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default)
    {
        dbContext.KnowledgeEntries.Remove(entry);
        return Task.CompletedTask;
    }

    public async Task ReplaceChunksAsync(
        Guid knowledgeEntryId,
        IReadOnlyList<KnowledgeChunk> chunks,
        CancellationToken cancellationToken = default)
    {
        var existing = await dbContext.KnowledgeChunks
            .Where(c => c.KnowledgeEntryId == knowledgeEntryId)
            .ToListAsync(cancellationToken);

        if (existing.Count > 0)
        {
            dbContext.KnowledgeChunks.RemoveRange(existing);
        }

        if (chunks.Count > 0)
        {
            await dbContext.KnowledgeChunks.AddRangeAsync(chunks, cancellationToken);
        }
    }

    public async Task<IReadOnlyList<KnowledgeChunkHit>> SearchChunksForProjectAsync(
        Guid projectId,
        float[] queryEmbedding,
        int topK,
        CancellationToken cancellationToken = default)
    {
        if (topK <= 0 || queryEmbedding.Length == 0)
        {
            return [];
        }

        // Live statuses only: Superseded / Deprecated are out of the prompt.
        var liveStatuses = new[]
        {
            KnowledgeStatus.Draft,
            KnowledgeStatus.Proposed,
            KnowledgeStatus.Accepted,
        };

        if (dbContext.Database.IsRelational())
        {
            // Cosine distance via pgvector (HNSW index on embedding). EF
            // translates Vector.CosineDistance to `<=>` under Npgsql.
            var query = new Vector(queryEmbedding);

            var rows = await (
                    from c in dbContext.KnowledgeChunks.AsNoTracking()
                    join e in dbContext.KnowledgeEntries.AsNoTracking()
                        on c.KnowledgeEntryId equals e.Id
                    where c.ProjectId == projectId
                          && c.Embedding != null
                          && liveStatuses.Contains(e.Status)
                          && e.Weight >= MinWeight
                    orderby c.Embedding!.CosineDistance(query)
                    select new
                    {
                        c.KnowledgeEntryId,
                        c.ChunkIndex,
                        c.Content,
                        e.Title,
                        e.Type,
                        e.Status,
                        e.Weight,
                        Similarity = 1.0 - (double)c.Embedding!.CosineDistance(query),
                    })
                .Take(topK)
                .ToListAsync(cancellationToken);

            return rows
                .Select(r => new KnowledgeChunkHit(
                    r.KnowledgeEntryId,
                    r.ChunkIndex,
                    r.Title,
                    r.Content,
                    r.Type,
                    r.Status,
                    r.Weight,
                    r.Similarity))
                .ToList();
        }

        // InMemory / non-relational: cosine in process (tests, no pgvector).
        var candidateRows = await dbContext.KnowledgeChunks
            .AsNoTracking()
            .Where(c => c.ProjectId == projectId && c.Embedding != null)
            .Join(
                dbContext.KnowledgeEntries.AsNoTracking(),
                c => c.KnowledgeEntryId,
                e => e.Id,
                (c, e) => new { Chunk = c, Entry = e })
            .ToListAsync(cancellationToken);

        return candidateRows
            .Where(r =>
                liveStatuses.Contains(r.Entry.Status) &&
                r.Entry.Weight >= MinWeight &&
                r.Chunk.Embedding is not null)
            .Select(r => new
            {
                r.Chunk,
                r.Entry,
                Similarity = CosineSimilarity(queryEmbedding, r.Chunk.Embedding!.ToArray()),
            })
            .OrderByDescending(r => r.Similarity)
            .Take(topK)
            .Select(r => new KnowledgeChunkHit(
                r.Chunk.KnowledgeEntryId,
                r.Chunk.ChunkIndex,
                r.Entry.Title,
                r.Chunk.Content,
                r.Entry.Type,
                r.Entry.Status,
                r.Entry.Weight,
                r.Similarity))
            .ToList();
    }

    private static double CosineSimilarity(float[] a, float[] b)
    {
        if (a.Length != b.Length || a.Length == 0)
        {
            return 0;
        }

        double dot = 0, normA = 0, normB = 0;
        for (var i = 0; i < a.Length; i++)
        {
            dot += a[i] * b[i];
            normA += a[i] * a[i];
            normB += b[i] * b[i];
        }

        if (normA <= 0 || normB <= 0)
        {
            return 0;
        }

        return dot / (Math.Sqrt(normA) * Math.Sqrt(normB));
    }
}
