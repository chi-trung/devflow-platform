using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class CustomFieldConfiguration : IEntityTypeConfiguration<CustomField>
{
    public void Configure(EntityTypeBuilder<CustomField> builder)
    {
        builder.ToTable("CustomFields");

        builder.HasKey(f => f.Id);

        builder.Property(f => f.ProjectId).IsRequired();
        builder.Property(f => f.Name).HasMaxLength(200).IsRequired();
        builder.Property(f => f.FieldType).HasMaxLength(50).IsRequired();
        builder.Property(f => f.Options).HasMaxLength(2000);

        builder.HasIndex(f => f.ProjectId);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(f => f.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class TaskCustomFieldValueConfiguration : IEntityTypeConfiguration<TaskCustomFieldValue>
{
    public void Configure(EntityTypeBuilder<TaskCustomFieldValue> builder)
    {
        builder.ToTable("TaskCustomFieldValues");

        builder.HasKey(v => v.Id);

        builder.Property(v => v.TaskId).IsRequired();
        builder.Property(v => v.FieldId).IsRequired();
        builder.Property(v => v.Value).HasMaxLength(2000);

        builder.HasIndex(v => new { v.TaskId, v.FieldId }).IsUnique();

        builder.HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(v => v.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<CustomField>()
            .WithMany()
            .HasForeignKey(v => v.FieldId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
