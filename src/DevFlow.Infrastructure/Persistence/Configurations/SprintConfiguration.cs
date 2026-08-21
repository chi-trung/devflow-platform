using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class SprintConfiguration : IEntityTypeConfiguration<Sprint>
{
    public void Configure(EntityTypeBuilder<Sprint> builder)
    {
        builder.ToTable("sprints");

        builder.Property(sprint => sprint.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(sprint => sprint.Goal)
            .HasMaxLength(500);

        builder.Property(sprint => sprint.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(sprint => sprint.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(sprint => new { sprint.ProjectId, sprint.Status });
    }
}
