using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public sealed class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("outbox_messages");

        builder.HasKey(m => m.Id);

        builder.Property(m => m.Type)
            .IsRequired()
            .HasMaxLength(256);

        builder.Property(m => m.Payload)
            .IsRequired();

        builder.Property(m => m.OccurredAtUtc)
            .IsRequired();

        builder.Property(m => m.ProcessedAtUtc);

        builder.Property(m => m.RetryCount)
            .IsRequired();

        builder.Property(m => m.Error)
            .HasMaxLength(1024);

        builder.Property(m => m.FailedPermanentlyAt);

        builder.HasIndex(m => new { m.ProcessedAtUtc, m.FailedPermanentlyAt, m.OccurredAtUtc });
    }
}
