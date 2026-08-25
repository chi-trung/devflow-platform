using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class ProjectMemberConfiguration : IEntityTypeConfiguration<ProjectMember>
{
    public void Configure(EntityTypeBuilder<ProjectMember> builder)
    {
        builder.ToTable("project_members");

        builder.HasKey(member => member.Id);

        builder.Property(member => member.Role)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(member => member.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(member => new { member.ProjectId, member.UserId })
            .IsUnique();
    }
}
