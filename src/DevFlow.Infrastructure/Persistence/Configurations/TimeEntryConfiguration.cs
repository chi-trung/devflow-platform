using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class TimeEntryConfiguration : IEntityTypeConfiguration<TimeEntry>
{
    public void Configure(EntityTypeBuilder<TimeEntry> builder)
    {
        builder.ToTable("TimeEntries");

        builder.HasKey(te => te.Id);

        builder.Property(te => te.TaskId)
            .IsRequired();

        builder.Property(te => te.UserId)
            .IsRequired();

        builder.Property(te => te.Minutes)
            .IsRequired();

        builder.Property(te => te.Description)
            .HasMaxLength(500);

        builder.HasIndex(te => te.TaskId);

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(te => te.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(te => te.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
