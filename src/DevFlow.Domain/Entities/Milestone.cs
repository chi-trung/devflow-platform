using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class Milestone : BaseEntity, IAuditableEntity
{
    private Milestone()
    {
    }

    private Milestone(Guid projectId, string name, string? description, DateTimeOffset? targetDateUtc)
    {
        ProjectId = projectId;
        Name = name;
        Description = description;
        TargetDateUtc = targetDateUtc;
    }

    public Guid ProjectId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public DateTimeOffset? TargetDateUtc { get; private set; }

    public MilestoneStatus Status { get; private set; } = MilestoneStatus.Planned;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Milestone Create(
        Guid projectId,
        string name,
        string? description,
        DateTimeOffset? targetDateUtc)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        return new Milestone(projectId, name.Trim(), description?.Trim(), targetDateUtc);
    }

    public void UpdateDetails(string name, string? description, DateTimeOffset? targetDateUtc)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        Name = name.Trim();
        Description = description?.Trim();
        TargetDateUtc = targetDateUtc;
    }

    public void UpdateStatus(MilestoneStatus status)
    {
        Status = status;
    }
}
