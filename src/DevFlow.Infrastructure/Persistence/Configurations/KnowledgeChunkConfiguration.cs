using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Pgvector;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class KnowledgeChunkConfiguration : IEntityTypeConfiguration<KnowledgeChunk>
{
    // Matches Ai:EmbeddingDimensions and the AddKnowledgeChunksWithPgvector
    // migration. Changing width requires a new migration, not just config.
    private const int EmbeddingDimensions = 768;

    public void Configure(EntityTypeBuilder<KnowledgeChunk> builder)
    {
        builder.ToTable("knowledge_chunks");

        builder.Property(c => c.Content)
            .HasMaxLength(8000)
            .IsRequired();

        builder.Property(c => c.Embedding)
            .HasColumnType($"vector({EmbeddingDimensions})");

        builder.HasOne<KnowledgeEntry>()
            .WithMany()
            .HasForeignKey(c => c.KnowledgeEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(c => c.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Vector search filters project_id first, then orders by embedding <=>.
        builder.HasIndex(c => new { c.ProjectId, c.ChunkIndex });
        builder.HasIndex(c => c.KnowledgeEntryId);

        // HNSW cosine index — created in the migration (extension + method
        // annotations are not portable through the model builder alone).
    }
}
