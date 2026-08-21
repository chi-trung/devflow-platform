using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class CommentConfiguration : IEntityTypeConfiguration<Comment>
{
    public void Configure(EntityTypeBuilder<Comment> builder)
    {
        builder.ToTable("comments");

        builder.Property(comment => comment.Content)
            .HasMaxLength(2000)
            .IsRequired();

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(comment => comment.TaskItemId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(comment => new { comment.TaskItemId, comment.CreatedAtUtc });
    }
}
