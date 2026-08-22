using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

public class PullRequestConfiguration : IEntityTypeConfiguration<PullRequest>
{
    public void Configure(EntityTypeBuilder<PullRequest> builder)
    {
        builder.ToTable("PullRequests");

        builder.HasKey(pr => pr.Id);

        builder.Property(pr => pr.ProjectId)
            .IsRequired();

        builder.Property(pr => pr.Title)
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(pr => pr.Url)
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(pr => pr.Status)
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(pr => pr.Author)
            .HasMaxLength(200);

        builder.HasIndex(pr => pr.ProjectId);

        builder.HasOne<Project>()
            .WithMany()
            .HasForeignKey(pr => pr.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
