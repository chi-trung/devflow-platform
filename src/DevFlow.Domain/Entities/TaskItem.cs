using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class TaskItem : BaseEntity, IAuditableEntity
{
    private TaskItem()
    {
    }

    private TaskItem(
        Guid projectId,
        string title,
        string? description,
        TaskItemPriority priority)
    {
        ProjectId = projectId;
        Title = title;
        Description = description;
        Priority = priority;
        Status = TaskItemStatus.Backlog;
    }

    public Guid ProjectId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public TaskItemStatus Status { get; private set; }

    public TaskItemPriority Priority { get; private set; }

    public Guid? AssigneeId { get; private set; }

    public DateTimeOffset? DueDateUtc { get; private set; }

    public DateTimeOffset? CompletedAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static TaskItem Create(
        Guid projectId,
        string title,
        string? description,
        TaskItemPriority priority)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        return new TaskItem(projectId, title.Trim(), description?.Trim(), priority);
    }

    public void UpdateDetails(string title, string? description, TaskItemPriority priority, DateTimeOffset? dueDateUtc)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        Title = title.Trim();
        Description = description?.Trim();
        Priority = priority;
        DueDateUtc = dueDateUtc;
    }

    public void ChangeStatus(TaskItemStatus status)
    {
        if (Status == TaskItemStatus.Done && status != TaskItemStatus.Done)
        {
            CompletedAtUtc = null;
        }

        Status = status;

        if (status == TaskItemStatus.Done)
        {
            CompletedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    public void AssignTo(Guid? userId) => AssigneeId = userId;
}
