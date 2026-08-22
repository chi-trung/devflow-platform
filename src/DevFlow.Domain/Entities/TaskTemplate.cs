using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class TaskTemplate : BaseEntity, IAuditableEntity
{
    private TaskTemplate()
    {
    }

    private TaskTemplate(Guid projectId, string name, string? title, string? description, TaskItemPriority priority)
    {
        ProjectId = projectId;
        Name = name;
        Title = title;
        Description = description;
        Priority = priority;
    }

    public Guid ProjectId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Title { get; private set; }

    public string? Description { get; private set; }

    public TaskItemPriority Priority { get; private set; }

    public int? EstimateMinutes { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static TaskTemplate Create(Guid projectId, string name, string? title, string? description, TaskItemPriority priority, int? estimateMinutes)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Template name is required.", nameof(name));

        return new TaskTemplate(projectId, name.Trim(), title?.Trim(), description?.Trim(), priority)
        {
            EstimateMinutes = estimateMinutes
        };
    }

    public void Update(string name, string? title, string? description, TaskItemPriority priority, int? estimateMinutes)
    {
        Name = name.Trim();
        Title = title?.Trim();
        Description = description?.Trim();
        Priority = priority;
        EstimateMinutes = estimateMinutes;
    }
}
