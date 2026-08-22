using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class NotificationPreferences : BaseEntity
{
    private NotificationPreferences() { }

    public Guid UserId { get; private set; }
    public bool EmailOnAssignment { get; set; } = true;
    public bool EmailOnMention { get; set; } = true;
    public bool EmailOnSprintStarted { get; set; } = true;

    public static NotificationPreferences Create(Guid userId)
    {
        return new NotificationPreferences { UserId = userId };
    }
}
