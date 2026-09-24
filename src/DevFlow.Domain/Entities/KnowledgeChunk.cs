using DevFlow.Domain.Common;
using Pgvector;

namespace DevFlow.Domain.Entities;

/// <summary>
/// One embedded slice of a KnowledgeEntry's content. Short bodies stay a
/// single chunk; longer ones are split with overlap so retrieval can hit a
/// mid-document passage without loading the whole entry. The embedding
/// column is pgvector <c>vector(768)</c> — both supported providers
/// (Gemini text-embedding-004, OpenAI text-embedding-3-small with
/// <c>dimensions=768</c>) are forced to the same width so one migration
/// serves either.
/// </summary>
public class KnowledgeChunk : BaseEntity, IAuditableEntity
{
    private KnowledgeChunk()
    {
    }

    private KnowledgeChunk(
        Guid knowledgeEntryId,
        Guid projectId,
        int chunkIndex,
        string content)
    {
        KnowledgeEntryId = knowledgeEntryId;
        ProjectId = projectId;
        ChunkIndex = chunkIndex;
        Content = content;
    }

    public Guid KnowledgeEntryId { get; private set; }

    /// <summary>Denormalised from the parent entry so vector search can filter by tenant without a join.</summary>
    public Guid ProjectId { get; private set; }

    public int ChunkIndex { get; private set; }

    /// <summary>Plain text of this slice (title + body slice for self-contained retrieval).</summary>
    public string Content { get; private set; } = string.Empty;

    /// <summary>Null until an embedding client runs (or when no API key is configured).</summary>
    public Vector? Embedding { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static KnowledgeChunk Create(
        Guid knowledgeEntryId,
        Guid projectId,
        int chunkIndex,
        string content)
    {
        return new KnowledgeChunk(knowledgeEntryId, projectId, chunkIndex, content);
    }

    public void SetEmbedding(float[] values)
    {
        Embedding = new Vector(values);
    }

    public void ClearEmbedding()
    {
        Embedding = null;
    }
}
