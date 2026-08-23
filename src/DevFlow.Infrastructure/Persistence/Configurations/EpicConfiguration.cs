using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class EpicConfiguration : IEntityTypeConfiguration<Epic>
{
    public void Configure(EntityTypeBuilder<Epic> builder)
    {
        builder.ToTable("epics");

        builder.Property(epic => epic.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(epic => epic.Description)
            .HasMaxLength(5000);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(epic => epic.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(epic => new { epic.ProjectId, epic.StartDateUtc });
    }
}
