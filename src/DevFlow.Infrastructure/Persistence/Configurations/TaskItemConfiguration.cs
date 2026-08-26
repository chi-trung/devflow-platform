using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class TaskItemConfiguration : IEntityTypeConfiguration<TaskItem>
{
    public void Configure(EntityTypeBuilder<TaskItem> builder)
    {
        builder.ToTable("task_items");

        builder.Property(task => task.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(task => task.Description)
            .HasMaxLength(5000);

        builder.Property(task => task.DefinitionOfDone)
            .HasMaxLength(2000)
            .IsRequired(false);

        builder.Property(task => task.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(task => task.Priority)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(task => task.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Sprint>()
            .WithMany()
            .HasForeignKey(task => task.SprintId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.HasOne<Epic>()
            .WithMany()
            .HasForeignKey(task => task.EpicId)
            .OnDelete(DeleteBehavior.SetNull);

        // Self-referencing hierarchy for subtasks. Children survive as top-level
        // tasks (ParentTaskId = null) when the parent is deleted.
        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(task => task.ParentTaskId)
            .OnDelete(DeleteBehavior.ClientSetNull);

        builder.Property(task => task.StoryPoints)
            .IsRequired(false);

        builder.HasIndex(task => new { task.ProjectId, task.Status });
        builder.HasIndex(task => task.EpicId);
        builder.HasIndex(task => task.ParentTaskId);
    }
}
