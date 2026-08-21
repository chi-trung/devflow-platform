namespace DevFlow.Application.Features.Tasks;

public sealed record TaskItemResponse(
    Guid Id,
    Guid ProjectId,
    string Title,
    string? Description,
    string Status,
    string Priority,
    Guid? AssigneeId,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc);
