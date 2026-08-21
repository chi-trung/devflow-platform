using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class WorkspaceConfiguration : IEntityTypeConfiguration<Workspace>
{
    public void Configure(EntityTypeBuilder<Workspace> builder)
    {
        builder.ToTable("workspaces");

        builder.HasKey(workspace => workspace.Id);

        builder.Property(workspace => workspace.Name)
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(workspace => workspace.Slug)
            .HasMaxLength(100)
            .IsRequired();

        builder.HasIndex(workspace => workspace.Slug)
            .IsUnique();

        builder.Property(workspace => workspace.Description)
            .HasMaxLength(500);

        builder
            .HasMany(workspace => workspace.Members)
            .WithOne(member => member.Workspace)
            .HasForeignKey(member => member.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(workspace => workspace.Members)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
