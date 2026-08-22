using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public sealed class TaskLabelConfiguration : IEntityTypeConfiguration<TaskLabel>
{
    public void Configure(EntityTypeBuilder<TaskLabel> builder)
    {
        builder.ToTable("task_labels");

        builder.HasKey(tl => new { tl.TaskItemId, tl.LabelId });

        builder.Property(tl => tl.TaskItemId)
            .IsRequired();

        builder.Property(tl => tl.LabelId)
            .IsRequired();

        builder.HasIndex(tl => tl.TaskItemId);
        builder.HasIndex(tl => tl.LabelId);
    }
}
