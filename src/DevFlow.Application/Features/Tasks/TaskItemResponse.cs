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
    AttachmentSummary? AttachmentSummary = null);

/// <summary>
/// Lightweight summary of a task's attachments for card thumbnails — ids only;
/// the frontend fetches bytes via the attachment download endpoint.
/// </summary>
public sealed record AttachmentSummary(int Count, IReadOnlyList<AttachmentPreview> Previews);

public sealed record AttachmentPreview(Guid Id, string ContentType);
