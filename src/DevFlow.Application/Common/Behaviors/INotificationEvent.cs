namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// Marker interface for commands that should trigger notifications.
/// Implement this on commands that need to create notifications for other users.
/// </summary>
public interface INotificationEvent
{
    /// <summary>
    /// The type of notification to create (e.g., "TaskAssigned", "CommentAdded", "StatusChanged").
    /// </summary>
    string NotificationType { get; }

    /// <summary>
    /// The user ID to receive the notification (null = derive from request).
    /// </summary>
    Guid? RecipientUserId { get; }

    /// <summary>
    /// The task item ID related to this notification (optional).
    /// </summary>
    Guid? TaskItemId { get; }

    /// <summary>
    /// The project ID related to this notification (optional).
    /// </summary>
    Guid? ProjectId { get; }

    /// <summary>
    /// The workspace ID related to this notification (optional).
    /// </summary>
    Guid? WorkspaceId { get; }

    /// <summary>
    /// Format the notification message. {actor} will be replaced with the current user's display name.
    /// </summary>
    string FormatMessage(string actorName);
}
