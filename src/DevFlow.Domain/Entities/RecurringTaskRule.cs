using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

/// <summary>
/// Sibling of TaskItem that describes a repeating spawn schedule. Each due
/// occurrence mints a fresh TaskItem; the rule itself stays and only advances
/// NextOccurrenceUtc (CAS-safe under concurrent processors).
/// </summary>
public class RecurringTaskRule : BaseEntity, IAuditableEntity, ISoftDeletable
{
    private RecurringTaskRule()
    {
    }

    private RecurringTaskRule(
        Guid projectId,
        string title,
        string? description,
        TaskItemPriority priority,
        RecurrenceFrequency frequency,
        int interval,
        DateTimeOffset firstDueDateUtc,
        Guid createdByUserId)
    {
        ProjectId = projectId;
        Title = title;
        Description = description;
        Priority = priority;
        Frequency = frequency;
        Interval = interval;
        FirstDueDateUtc = firstDueDateUtc;
        NextOccurrenceUtc = firstDueDateUtc;
        IsActive = true;
        CreatedByUserId = createdByUserId;
    }

    public Guid ProjectId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public TaskItemPriority Priority { get; private set; }

    public RecurrenceFrequency Frequency { get; private set; }

    /// <summary>How many frequency units between occurrences (≥ 1). Daily + 2 = every 2 days.</summary>
    public int Interval { get; private set; }

    public DateTimeOffset FirstDueDateUtc { get; private set; }

    /// <summary>
    /// Next spawn cursor. Starts equal to FirstDueDateUtc (even if past, so a
    /// just-created rule due now fires on the next processor tick). Advanced
    /// only via TryAdvanceFrom so concurrent workers cannot double-spawn.
    /// </summary>
    public DateTimeOffset NextOccurrenceUtc { get; private set; }

    public bool IsActive { get; private set; }

    /// <summary>Task the rule was seeded from (SetNull if that task is deleted).</summary>
    public Guid? SeedTaskId { get; private set; }

    /// <summary>Actor for spawned-task activity logs after the creator is gone from HTTP context.</summary>
    public Guid CreatedByUserId { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public DateTimeOffset? DeletedAtUtc { get; set; }

    public static RecurringTaskRule Create(
        Guid projectId,
        string title,
        string? description,
        TaskItemPriority priority,
        RecurrenceFrequency frequency,
        int interval,
        DateTimeOffset firstDueDateUtc,
        Guid createdByUserId,
        Guid? seedTaskId = null)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (interval < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(interval), "Interval must be at least 1.");
        }

        if (createdByUserId == Guid.Empty)
        {
            throw new ArgumentException("Creator is required.", nameof(createdByUserId));
        }

        return new RecurringTaskRule(
            projectId,
            title.Trim(),
            description?.Trim(),
            priority,
            frequency,
            interval,
            firstDueDateUtc,
            createdByUserId)
        {
            SeedTaskId = seedTaskId
        };
    }

    public void Update(
        string title,
        string? description,
        TaskItemPriority priority,
        RecurrenceFrequency frequency,
        int interval,
        DateTimeOffset firstDueDateUtc,
        bool isActive)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        if (interval < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(interval), "Interval must be at least 1.");
        }

        var cadenceChanged =
            Frequency != frequency
            || Interval != interval
            || FirstDueDateUtc != firstDueDateUtc;

        Title = title.Trim();
        Description = description?.Trim();
        Priority = priority;
        Frequency = frequency;
        Interval = interval;
        FirstDueDateUtc = firstDueDateUtc;
        IsActive = isActive;

        // Recompute the cursor only when the schedule itself changed; a pure
        // pause/resume or rename must not rewind a series that is mid-flight.
        // From-wall-clock when active so "edit every Friday" does not instantly
        // re-fire an occurrence already handed out.
        if (cadenceChanged)
        {
            NextOccurrenceUtc = isActive
                ? NextFrom(firstDueDateUtc > DateTimeOffset.UtcNow ? firstDueDateUtc : DateTimeOffset.UtcNow, frequency, interval)
                : firstDueDateUtc;
        }
    }

    public void SetActive(bool isActive) => IsActive = isActive;

    /// <summary>
    /// Compare-and-swap the spawn cursor. Returns false (and leaves the rule
    /// untouched) when another worker already advanced past <paramref name="expected"/>.
    /// </summary>
    public bool TryAdvanceFrom(DateTimeOffset expected)
    {
        if (NextOccurrenceUtc != expected)
        {
            return false;
        }

        NextOccurrenceUtc = NextFrom(expected, Frequency, Interval);
        return true;
    }

    public static DateTimeOffset NextFrom(DateTimeOffset from, RecurrenceFrequency frequency, int interval)
    {
        if (interval < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(interval), "Interval must be at least 1.");
        }

        return frequency switch
        {
            RecurrenceFrequency.Daily => from.AddDays(interval),
            RecurrenceFrequency.Weekly => from.AddDays(7d * interval),
            RecurrenceFrequency.Monthly => from.AddMonths(interval),
            _ => throw new ArgumentOutOfRangeException(nameof(frequency), frequency, null),
        };
    }
}
