using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class RecurringTaskRuleConfiguration : IEntityTypeConfiguration<RecurringTaskRule>
{
    public void Configure(EntityTypeBuilder<RecurringTaskRule> builder)
    {
        builder.ToTable("recurring_task_rules");

        builder.HasKey(rule => rule.Id);

        builder.Property(rule => rule.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(rule => rule.Description)
            .HasMaxLength(5000);

        builder.Property(rule => rule.Frequency)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(rule => rule.Priority)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(rule => rule.Interval)
            .IsRequired();

        builder.Property(rule => rule.IsActive)
            .IsRequired();

        builder.Property(rule => rule.CreatedByUserId)
            .IsRequired();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(rule => rule.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(rule => rule.SeedTaskId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(rule => rule.ProjectId);

        // Processor polls (IsActive, NextOccurrenceUtc <= now).
        builder.HasIndex(rule => new { rule.IsActive, rule.NextOccurrenceUtc });

        // Soft-deleted rules must not claim their cursor slot forever if we
        // ever re-activate a restored row; filter keeps them out of reads.
        builder.HasQueryFilter(rule => rule.DeletedAtUtc == null);
    }
}
