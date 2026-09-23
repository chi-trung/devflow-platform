using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class WorkspaceInvitation : BaseEntity, IAuditableEntity
{
    private WorkspaceInvitation()
    {
    }

    private WorkspaceInvitation(
        Guid workspaceId,
        Guid invitedUserId,
        string invitedEmail,
        WorkspaceRole role,
        Guid invitedByUserId)
    {
        WorkspaceId = workspaceId;
        InvitedUserId = invitedUserId;
        InvitedEmail = invitedEmail;
        Role = role;
        InvitedByUserId = invitedByUserId;
        Status = InvitationStatus.Pending;
        InvitedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid WorkspaceId { get; private set; }

    /// <summary>Resolved account that was invited (invite requires an existing user by email).</summary>
    public Guid InvitedUserId { get; private set; }

    /// <summary>Email the admin typed — kept for display and audit even if the user later changes email.</summary>
    public string InvitedEmail { get; private set; } = string.Empty;

    public WorkspaceRole Role { get; private set; }

    public InvitationStatus Status { get; private set; }

    public Guid InvitedByUserId { get; private set; }

    public DateTimeOffset InvitedAtUtc { get; private set; }

    public DateTimeOffset? RespondedAtUtc { get; private set; }

    public Workspace Workspace { get; private set; } = null!;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static WorkspaceInvitation Create(
        Guid workspaceId,
        Guid invitedUserId,
        string invitedEmail,
        WorkspaceRole role,
        Guid invitedByUserId)
    {
        if (workspaceId == Guid.Empty)
        {
            throw new ArgumentException("Workspace id is required.", nameof(workspaceId));
        }

        if (invitedUserId == Guid.Empty)
        {
            throw new ArgumentException("Invited user id is required.", nameof(invitedUserId));
        }

        if (string.IsNullOrWhiteSpace(invitedEmail))
        {
            throw new ArgumentException("Invited email is required.", nameof(invitedEmail));
        }

        if (role == WorkspaceRole.Owner)
        {
            throw new ArgumentException("Cannot invite directly as Owner.", nameof(role));
        }

        return new WorkspaceInvitation(
            workspaceId,
            invitedUserId,
            invitedEmail.Trim().ToLowerInvariant(),
            role,
            invitedByUserId);
    }

    public void Accept()
    {
        if (Status != InvitationStatus.Pending)
        {
            throw new InvalidOperationException($"Invitation is {Status} and cannot be accepted.");
        }

        Status = InvitationStatus.Accepted;
        RespondedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Decline()
    {
        if (Status != InvitationStatus.Pending)
        {
            throw new InvalidOperationException($"Invitation is {Status} and cannot be declined.");
        }

        Status = InvitationStatus.Declined;
        RespondedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Revoke()
    {
        if (Status != InvitationStatus.Pending)
        {
            throw new InvalidOperationException($"Invitation is {Status} and cannot be revoked.");
        }

        Status = InvitationStatus.Revoked;
        RespondedAtUtc = DateTimeOffset.UtcNow;
    }
}
