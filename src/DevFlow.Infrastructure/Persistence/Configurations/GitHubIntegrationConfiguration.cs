using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class GitHubIntegrationConfiguration : IEntityTypeConfiguration<GitHubIntegration>
{
    public void Configure(EntityTypeBuilder<GitHubIntegration> builder)
    {
        builder.ToTable("GitHubIntegrations");

        builder.HasKey(gi => gi.Id);

        builder.Property(gi => gi.ProjectId)
            .IsRequired();

        builder.Property(gi => gi.RepositoryUrl)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(gi => gi.WebhookSecret)
            .HasMaxLength(200);

        builder.HasIndex(gi => gi.ProjectId)
            .IsUnique();

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(gi => gi.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
