using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class TimeEntry : BaseEntity, IAuditableEntity
{
    private TimeEntry()
    {
    }

    private TimeEntry(Guid taskId, Guid userId, int minutes, string? description, DateTimeOffset dateUtc)
    {
        TaskId = taskId;
        UserId = userId;
        Minutes = minutes;
        Description = description;
        DateUtc = dateUtc;
    }

    public Guid TaskId { get; private set; }

    public Guid UserId { get; private set; }

    public int Minutes { get; private set; }

    public string? Description { get; private set; }

    public DateTimeOffset DateUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static TimeEntry Create(Guid taskId, Guid userId, int minutes, string? description, DateTimeOffset dateUtc)
    {
        if (minutes <= 0)
            throw new ArgumentException("Minutes must be positive.", nameof(minutes));

        return new TimeEntry(taskId, userId, minutes, description?.Trim(), dateUtc);
    }

    /// <summary>
    /// Rebuild an entry from a backup: work date and creation date are the
    /// exported values, not "now" (same restore-after-stamp pattern as
    /// Comment.CreatedAtUtc — the audit interceptor may still refresh
    /// CreatedAtUtc on save, which is the accepted shipped behavior).
    /// </summary>
    public static TimeEntry Restore(
        Guid taskId,
        Guid userId,
        int minutes,
        string? description,
        DateTimeOffset dateUtc,
        DateTimeOffset createdAtUtc)
    {
        if (minutes <= 0)
            throw new ArgumentException("Minutes must be positive.", nameof(minutes));

        var entry = new TimeEntry(taskId, userId, minutes, description?.Trim(), dateUtc)
        {
            CreatedAtUtc = createdAtUtc
        };
        return entry;
    }

    public void Update(int minutes, string? description)
    {
        if (minutes <= 0)
            throw new ArgumentException("Minutes must be positive.", nameof(minutes));

        Minutes = minutes;
        Description = description?.Trim();
    }
}
