using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class ActivityLogConfiguration : IEntityTypeConfiguration<ActivityLog>
{
    public void Configure(EntityTypeBuilder<ActivityLog> builder)
    {
        builder.ToTable("activity_logs");

        builder.Property(activity => activity.Action)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(activity => activity.Target)
            .HasMaxLength(200);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(activity => activity.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(activity => activity.TaskItemId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasIndex(activity => new { activity.ProjectId, activity.CreatedAtUtc });
    }
}
