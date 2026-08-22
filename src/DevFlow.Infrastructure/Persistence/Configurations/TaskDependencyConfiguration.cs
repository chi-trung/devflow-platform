using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class TaskDependencyConfiguration : IEntityTypeConfiguration<TaskDependency>
{
    public void Configure(EntityTypeBuilder<TaskDependency> builder)
    {
        builder.ToTable("TaskDependencies");

        builder.HasKey(td => td.Id);

        builder.Property(td => td.BlockedTaskId)
            .IsRequired();

        builder.Property(td => td.BlockerTaskId)
            .IsRequired();

        builder.HasIndex(td => new { td.BlockedTaskId, td.BlockerTaskId })
            .IsUnique();

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(td => td.BlockedTaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(td => td.BlockerTaskId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
