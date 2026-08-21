using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class ActivityLog : BaseEntity, IAuditableEntity
{
    private ActivityLog()
    {
    }

    private ActivityLog(
        Guid workspaceId,
        Guid projectId,
        Guid? taskItemId,
        Guid actorUserId,
        string action,
        string target)
    {
        WorkspaceId = workspaceId;
        ProjectId = projectId;
        TaskItemId = taskItemId;
        ActorUserId = actorUserId;
        Action = action;
        Target = target;
    }

    public Guid WorkspaceId { get; private set; }

    public Guid ProjectId { get; private set; }

    public Guid? TaskItemId { get; private set; }

    public Guid ActorUserId { get; private set; }

    public string Action { get; private set; } = string.Empty;

    public string Target { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static ActivityLog Create(
        Guid workspaceId,
        Guid projectId,
        Guid? taskItemId,
        Guid actorUserId,
        string action,
        string target)
    {
        if (string.IsNullOrWhiteSpace(action))
        {
            throw new ArgumentException("Action is required.", nameof(action));
        }

        return new ActivityLog(
            workspaceId,
            projectId,
            taskItemId,
            actorUserId,
            action.Trim(),
            target?.Trim() ?? string.Empty);
    }
}
