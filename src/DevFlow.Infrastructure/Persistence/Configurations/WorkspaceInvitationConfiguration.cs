using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace DevFlow.Infrastructure.Persistence.Configurations;

internal sealed class WorkspaceInvitationConfiguration : IEntityTypeConfiguration<WorkspaceInvitation>
{
    public void Configure(EntityTypeBuilder<WorkspaceInvitation> builder)
    {
        builder.ToTable("workspace_invitations");

        builder.HasKey(invitation => invitation.Id);

        builder.Property(invitation => invitation.InvitedEmail)
            .HasMaxLength(320)
            .IsRequired();

        builder.Property(invitation => invitation.Role)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(invitation => invitation.Status)
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.HasOne(invitation => invitation.Workspace)
            .WithMany()
            .HasForeignKey(invitation => invitation.WorkspaceId)
            .OnDelete(DeleteBehavior.Cascade);

        // Soft uniqueness: only one live invite per (workspace, user). Accepted/
        // Declined/Revoked rows keep the slot free for a re-invite.
        builder.HasIndex(invitation => new { invitation.WorkspaceId, invitation.InvitedUserId })
            .IsUnique()
            .HasFilter("status = 'Pending'");

        builder.HasIndex(invitation => new { invitation.InvitedUserId, invitation.Status });
        builder.HasIndex(invitation => new { invitation.WorkspaceId, invitation.Status });
    }
}
