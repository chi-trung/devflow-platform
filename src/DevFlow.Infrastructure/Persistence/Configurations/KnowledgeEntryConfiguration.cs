using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class KnowledgeEntryConfiguration : IEntityTypeConfiguration<KnowledgeEntry>
{
    public void Configure(EntityTypeBuilder<KnowledgeEntry> builder)
    {
        builder.ToTable("knowledge_entries");

        builder.Property(k => k.Title)
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(k => k.Body)
            .HasMaxLength(20000);

        builder.Property(k => k.Type)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(k => k.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(k => k.Weight)
            .HasPrecision(3, 2);

        builder.Property(k => k.Tags)
            .HasMaxLength(500);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(k => k.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(k => k.TaskId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<KnowledgeEntry>()
            .WithMany()
            .HasForeignKey(k => k.SupersededById)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(k => new { k.ProjectId, k.Status });
        builder.HasIndex(k => new { k.ProjectId, k.Type });
        builder.HasIndex(k => k.TaskId);
    }
}
