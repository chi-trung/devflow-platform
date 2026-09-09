using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class ProjectConfiguration : IEntityTypeConfiguration<Project>
{
    public void Configure(EntityTypeBuilder<Project> builder)
    {
        builder.ToTable("projects");

        builder.HasKey(project => project.Id);

        builder.Property(project => project.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(project => project.Key)
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(project => project.Description)
            .HasMaxLength(500);

        builder.Property(project => project.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(project => project.ApproveAiPlans)
            .IsRequired();

        // Partial so soft-deleted projects release their key — otherwise a
        // deleted project's row keeps occupying (workspace_id, key) and the
        // app-side pre-check (which honours the DeletedAtUtc query filter)
        // can't see it, turning reuse into a raw 23505 → 500.
        builder.HasIndex(project => new { project.WorkspaceId, project.Key })
            .IsUnique()
            .HasFilter("deleted_at_utc IS NULL");

        builder
            .HasOne<Domain.Entities.Workspace>()
            .WithMany()
            .HasForeignKey(project => project.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
