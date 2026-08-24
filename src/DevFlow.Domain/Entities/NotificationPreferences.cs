using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class NotificationPreferences : BaseEntity
{
    private NotificationPreferences() { }

    public Guid UserId { get; private set; }
    public bool EmailOnAssignment { get; set; } = true;
    public bool EmailOnMention { get; set; } = true;
    public bool EmailOnSprintStarted { get; set; } = true;
    public bool InAppOnAssignment { get; set; } = true;
    public bool InAppOnMention { get; set; } = true;
    public bool InAppOnSprintStarted { get; set; } = true;
    public bool EmailOnStatusChanged { get; set; } = true;
    public bool InAppOnStatusChanged { get; set; } = true;
    public bool EmailOnCommentAdded { get; set; } = true;
    public bool InAppOnCommentAdded { get; set; } = true;
    public bool EmailOnRoleChanged { get; set; } = true;
    public bool InAppOnRoleChanged { get; set; } = true;
    public bool EmailOnRemovedFromWorkspace { get; set; } = true;
    public bool InAppOnRemovedFromWorkspace { get; set; } = true;

    public static NotificationPreferences Create(Guid userId)
    {
        return new NotificationPreferences { UserId = userId };
    }
}