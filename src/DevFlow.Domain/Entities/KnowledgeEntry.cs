using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

/// <summary>
/// A compounding knowledge item — an ADR, a reusable pattern, or a runbook —
/// scoped to a project. Entries start as Draft (e.g. auto-captured when a task
/// ships) and move through Proposed → Accepted, or into Superseded/Deprecated.
/// The weight field lets higher-confidence entries rank above speculative ones
/// when the AI planner reads the project's knowledge base.
/// </summary>
public class KnowledgeEntry : BaseEntity, IAuditableEntity
{
    private KnowledgeEntry()
    {
    }

    private KnowledgeEntry(
        Guid projectId,
        Guid? taskId,
        string title,
        string? body,
        KnowledgeType type,
        string? tags,
        Guid? createdBy)
    {
        ProjectId = projectId;
        TaskId = taskId;
        Title = title;
        Body = body;
        Type = type;
        Tags = tags;
        Status = KnowledgeStatus.Draft;
        Weight = 1m;
        CreatedBy = createdBy;
    }

    public Guid ProjectId { get; private set; }

    /// <summary>The task this entry was auto-captured from (null for manual entries).</summary>
    public Guid? TaskId { get; private set; }

    public string Title { get; private set; } = string.Empty;

    public string? Body { get; private set; }

    public KnowledgeType Type { get; private set; }

    public KnowledgeStatus Status { get; private set; } = KnowledgeStatus.Draft;

    /// <summary>0..1 confidence/importance rank, default 1 for authored entries.</summary>
    public decimal Weight { get; private set; } = 1m;

    public string? Tags { get; private set; }

    public Guid? SupersededById { get; private set; }

    /// <summary>Set when the source task changed after this entry was captured — the content may be stale.</summary>
    public bool NeedsReview { get; private set; }

    public DateTimeOffset? DriftedAtUtc { get; private set; }

    public string? DriftReason { get; private set; }

    public Guid? CreatedBy { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static KnowledgeEntry Create(
        Guid projectId,
        string title,
        string? body,
        KnowledgeType type,
        string? tags = null,
        Guid? createdBy = null)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        return new KnowledgeEntry(
            projectId,
            null,
            title.Trim(),
            body?.Trim(),
            type,
            tags?.Trim(),
            createdBy);
    }

    /// <summary>Builds a Draft entry from a completed task (the auto-capture path).</summary>
    public static KnowledgeEntry CaptureFromTask(
        Guid projectId,
        Guid taskId,
        string title,
        string? body,
        KnowledgeType type,
        string? tags = null)
    {
        return new KnowledgeEntry(
            projectId,
            taskId,
            title,
            body,
            type,
            tags,
            null);
    }

    public void UpdateDetails(string title, string? body, KnowledgeType type, string? tags)
    {
        if (string.IsNullOrWhiteSpace(title))
        {
            throw new ArgumentException("Title is required.", nameof(title));
        }

        Title = title.Trim();
        Body = body?.Trim();
        Type = type;
        Tags = tags?.Trim();
    }

    public void UpdateStatus(KnowledgeStatus status)
    {
        Status = status;
    }

    /// <summary>
    /// Marks this entry as superseded by <paramref name="newEntryId"/> and drops
    /// its weight so the newer decision outranks it in knowledge-gated planning.
    /// </summary>
    public void MarkSupersededBy(Guid newEntryId)
    {
        SupersededById = newEntryId;
        Status = KnowledgeStatus.Superseded;
        Weight = 0.05m;
    }

    public void Deprecate()
    {
        Status = KnowledgeStatus.Deprecated;
        Weight = 0.05m;
    }

    public void SetWeight(decimal weight)
    {
        Weight = Math.Clamp(weight, 0m, 1m);
    }

    /// <summary>
    /// Flags this entry for review because its source task moved on after the
    /// entry was captured — the documented decision may no longer hold.
    /// </summary>
    public void FlagDrift(string reason)
    {
        if (Status is KnowledgeStatus.Superseded or KnowledgeStatus.Deprecated)
        {
            return;
        }

        NeedsReview = true;
        DriftedAtUtc = DateTimeOffset.UtcNow;
        DriftReason = string.IsNullOrWhiteSpace(reason) ? "Source task changed" : reason.Trim();
    }

    /// <summary>Clears the drift flag after a human reviews and refreshes the content.</summary>
    public void ClearDrift()
    {
        NeedsReview = false;
        DriftedAtUtc = null;
        DriftReason = null;
    }
}
