using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class Notification : BaseEntity, IAuditableEntity
{
    private Notification()
    {
    }

    private Notification(
        Guid userId,
        string type,
        string message,
        Guid? taskItemId,
        Guid? projectId,
        Guid? workspaceId)
    {
        UserId = userId;
        Type = type;
        Message = message;
        TaskItemId = taskItemId;
        ProjectId = projectId;
        WorkspaceId = workspaceId;
    }

    public Guid UserId { get; private set; }

    public string Type { get; private set; } = string.Empty;

    public string Message { get; private set; } = string.Empty;

    public Guid? TaskItemId { get; private set; }

    public Guid? ProjectId { get; private set; }

    public Guid? WorkspaceId { get; private set; }

    public DateTimeOffset? ReadAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public bool IsRead => ReadAtUtc.HasValue;

    public static Notification Create(
        Guid userId,
        string type,
        string message,
        Guid? taskItemId = null,
        Guid? projectId = null,
        Guid? workspaceId = null)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            throw new ArgumentException("Type is required.", nameof(type));
        }

        if (string.IsNullOrWhiteSpace(message))
        {
            throw new ArgumentException("Message is required.", nameof(message));
        }

        return new Notification(userId, type, message, taskItemId, projectId, workspaceId);
    }

    public void MarkAsRead()
    {
        ReadAtUtc = DateTimeOffset.UtcNow;
    }
}
