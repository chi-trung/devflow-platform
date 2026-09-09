namespace DevFlow.Application.Features.Tasks;

public sealed record TaskItemResponse(
    Guid Id,
    Guid ProjectId,
    /// <summary>"{Project.Key}-{Number}" — the Linear/Jira-style identifier (e.g. "DEV-42").</summary>
    string Key,
    int Number,
    string Title,
    string? Description,
    string? DefinitionOfDone,
    string Status,
    string Priority,
    Guid? AssigneeId,
    Guid? SprintId,
    Guid? EpicId,
    Guid? ParentTaskId,
    int? StoryPoints,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int Position,
    AttachmentSummary? AttachmentSummary = null,
    PullRequestSummary? PrSummary = null);

/// <summary>
/// Lightweight summary of a task's attachments for card thumbnails — ids only;
/// the frontend fetches bytes via the attachment download endpoint.
/// </summary>
public sealed record AttachmentSummary(int Count, IReadOnlyList<AttachmentPreview> Previews);

public sealed record AttachmentPreview(Guid Id, string ContentType);

/// <summary>
/// Linked pull-request counts for the board card badge. The status buckets
/// absorb the legacy lowercase "open" as well as the "Open"/"Merged"/"Closed"
/// written by the webhook and manual flows (matched case-insensitively).
/// </summary>
public sealed record PullRequestSummary(int Open, int Merged, int Closed);
