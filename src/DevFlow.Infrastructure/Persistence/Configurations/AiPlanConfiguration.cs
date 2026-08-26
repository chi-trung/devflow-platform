using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class AiPlanConfiguration : IEntityTypeConfiguration<AiPlan>
{
    public void Configure(EntityTypeBuilder<AiPlan> builder)
    {
        builder.ToTable("ai_plans");

        builder.HasKey(plan => plan.Id);

        builder.Property(plan => plan.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(plan => plan.Summary)
            .HasMaxLength(500);

        builder.Property(plan => plan.StepsJson)
            .HasMaxLength(8000);

        builder.Property(plan => plan.SubtasksJson)
            .HasMaxLength(16000);

        builder.Property(plan => plan.DefinitionOfDoneJson)
            .HasMaxLength(8000);

        builder
            .HasOne<Project>()
            .WithMany()
            .HasForeignKey(plan => plan.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder
            .HasOne<TaskItem>()
            .WithMany()
            .HasForeignKey(plan => plan.TaskId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(plan => new { plan.TaskId, plan.Status });
        builder.HasIndex(plan => plan.ProjectId);
    }
}
