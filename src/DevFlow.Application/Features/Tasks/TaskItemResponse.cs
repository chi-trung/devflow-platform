namespace DevFlow.Application.Features.Tasks;

public sealed record TaskItemResponse(
    Guid Id,
    Guid ProjectId,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? AssigneeId,
    Guid? SprintId,
    Guid? EpicId,
    Guid? ParentTaskId,
    int? StoryPoints,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    int Position);
