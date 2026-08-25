using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class EpicDependencyConfiguration : IEntityTypeConfiguration<EpicDependency>
{
    public void Configure(EntityTypeBuilder<EpicDependency> builder)
    {
        builder.ToTable("epic_dependencies");

        builder.HasKey(e => e.Id);

        builder.HasIndex(e => new { e.EpicId, e.BlockedById })
            .IsUnique();

        builder.HasOne<Epic>()
            .WithMany()
            .HasForeignKey(e => e.EpicId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Epic>()
            .WithMany()
            .HasForeignKey(e => e.BlockedById)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
