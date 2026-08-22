using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class WebhookConfiguration : IEntityTypeConfiguration<Webhook>
{
    public void Configure(EntityTypeBuilder<Webhook> builder)
    {
        builder.HasKey(w => w.Id);

        builder.Property(w => w.Url)
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(w => w.Events)
            .HasConversion(
                v => string.Join(",", v),
                v => v.Split(",", StringSplitOptions.RemoveEmptyEntries));

        builder.Property(w => w.Secret)
            .HasMaxLength(500);

        builder.HasOne<Workspace>()
            .WithMany()
            .HasForeignKey(w => w.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(w => w.WorkspaceId);
    }
}
