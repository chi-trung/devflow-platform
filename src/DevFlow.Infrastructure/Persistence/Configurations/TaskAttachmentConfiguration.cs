using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class TaskAttachmentConfiguration : IEntityTypeConfiguration<TaskAttachment>
{
    public void Configure(EntityTypeBuilder<TaskAttachment> builder)
    {
        builder.ToTable("task_attachments");

        builder.Property(attachment => attachment.FileName)
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(attachment => attachment.ContentType)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(attachment => attachment.Data)
            .IsRequired();

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(attachment => attachment.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(attachment => attachment.TaskItemId);
    }
}
