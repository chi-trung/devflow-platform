using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class SavedSearchConfiguration : IEntityTypeConfiguration<SavedSearch>
{
    public void Configure(EntityTypeBuilder<SavedSearch> builder)
    {
        builder.HasKey(ss => ss.Id);

        builder.Property(ss => ss.Name)
            .HasMaxLength(200)
            .IsRequired();

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(ss => ss.UserId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(ss => new { ss.UserId, ss.WorkspaceId });
    }
}
