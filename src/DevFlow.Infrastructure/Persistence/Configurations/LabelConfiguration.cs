using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public sealed class LabelConfiguration : IEntityTypeConfiguration<Label>
{
    public void Configure(EntityTypeBuilder<Label> builder)
    {
        builder.ToTable("labels");

        builder.HasKey(l => l.Id);

        builder.Property(l => l.ProjectId)
            .IsRequired();

        builder.Property(l => l.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(l => l.Color)
            .HasMaxLength(7)
            .IsRequired();

        builder.HasIndex(l => new { l.ProjectId, l.Name })
            .IsUnique();
    }
}
