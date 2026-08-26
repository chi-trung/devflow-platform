using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class Epic : BaseEntity, IAuditableEntity
{
    private Epic()
    {
    }

    private Epic(Guid projectId, string name, string? description)
    {
        ProjectId = projectId;
        Name = name;
        Description = description;
    }

    public Guid ProjectId { get; private set; }

    public Guid? MilestoneId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public DateTimeOffset? StartDateUtc { get; private set; }

    public DateTimeOffset? EndDateUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Epic Create(Guid projectId, string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        return new Epic(projectId, name.Trim(), description?.Trim());
    }

    public void AttachToMilestone(Guid? milestoneId)
    {
        MilestoneId = milestoneId;
    }

    public static Epic Create(
        Guid projectId,
        string name,
        string? description,
        DateTimeOffset? startDateUtc,
        DateTimeOffset? endDateUtc)
    {
        var epic = Create(projectId, name, description);
        epic.UpdateDetails(name, description, startDateUtc, endDateUtc);
        return epic;
    }

    public void UpdateDetails(
        string name,
        string? description,
        DateTimeOffset? startDateUtc,
        DateTimeOffset? endDateUtc)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (startDateUtc.HasValue && endDateUtc.HasValue && endDateUtc.Value < startDateUtc.Value)
        {
            throw new ArgumentException("End date must be after start date.", nameof(endDateUtc));
        }

        Name = name.Trim();
        Description = description?.Trim();
        StartDateUtc = startDateUtc;
        EndDateUtc = endDateUtc;
    }
}
