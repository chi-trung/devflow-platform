using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class Sprint : BaseEntity, IAuditableEntity
{
    private Sprint()
    {
    }

    private Sprint(Guid projectId, string name, string? goal)
    {
        ProjectId = projectId;
        Name = name;
        Goal = goal;
        Status = SprintStatus.Planned;
    }

    public Guid ProjectId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Goal { get; private set; }

    public SprintStatus Status { get; private set; }

    public DateTimeOffset? StartDateUtc { get; private set; }

    public DateTimeOffset? EndDateUtc { get; private set; }

    public DateTimeOffset? CompletedAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Sprint Create(Guid projectId, string name, string? goal)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        return new Sprint(projectId, name.Trim(), goal?.Trim());
    }

    public void Start(DateTimeOffset startDateUtc, DateTimeOffset endDateUtc)
    {
        if (Status != SprintStatus.Planned)
        {
            throw new InvalidOperationException("Only planned sprints can be started.");
        }

        if (endDateUtc <= startDateUtc)
        {
            throw new ArgumentException("End date must be after start date.", nameof(endDateUtc));
        }

        StartDateUtc = startDateUtc;
        EndDateUtc = endDateUtc;
        Status = SprintStatus.Active;
    }

    public void Complete()
    {
        if (Status != SprintStatus.Active)
        {
            throw new InvalidOperationException("Only active sprints can be completed.");
        }

        Status = SprintStatus.Completed;
        CompletedAtUtc = DateTimeOffset.UtcNow;
    }
}
