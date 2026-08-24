using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class TaskItem : BaseEntity, IAuditableEntity, ISoftDeletable
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

    public Guid? SprintId { get; private set; }

    public Guid? EpicId { get; private set; }

    public Guid? ParentTaskId { get; private set; }

    public int? StoryPoints { get; private set; }

    public DateTimeOffset? DueDateUtc { get; private set; }

    public DateTimeOffset? CompletedAtUtc { get; private set; }

    public DateTimeOffset? StartedAtUtc { get; private set; }

    public int? EstimateMinutes { get; private set; }

    public int Position { get; set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public DateTimeOffset? DeletedAtUtc { get; set; }

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

        if (status == TaskItemStatus.InProgress && StartedAtUtc is null)
        {
            StartedAtUtc = DateTimeOffset.UtcNow;
        }

        if (status == TaskItemStatus.Done)
        {
            CompletedAtUtc = DateTimeOffset.UtcNow;
        }
    }

    public void AssignTo(Guid? userId) => AssigneeId = userId;

    public void AssignToSprint(Guid sprintId) => SprintId = sprintId;

    public void RemoveFromSprint() => SprintId = null;

    public void SetEstimate(int? estimateMinutes)
    {
        EstimateMinutes = estimateMinutes;
    }

    public void AttachToEpic(Guid? epicId) => EpicId = epicId;

    public void AttachToParent(Guid parentTaskId)
    {
        if (parentTaskId == Id)
        {
            throw new InvalidOperationException("A task cannot be its own parent.");
        }

        ParentTaskId = parentTaskId;
    }

    public void DetachFromParent() => ParentTaskId = null;

    public void SetStoryPoints(int? storyPoints) => StoryPoints = storyPoints;
}
