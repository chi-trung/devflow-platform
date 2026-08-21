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

        builder.HasIndex(project => new { project.WorkspaceId, project.Key })
            .IsUnique();

        builder
            .HasOne<Domain.Entities.Workspace>()
            .WithMany()
            .HasForeignKey(project => project.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
