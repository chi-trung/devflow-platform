using DevFlow.Domain.Enums;

namespace DevFlow.Api.Contracts.Tasks;

public sealed record CreateTaskItemRequest(
    string Title,
    string? Description,
    TaskItemPriority Priority,
    DateTimeOffset? DueDateUtc,
    string? DefinitionOfDone = null);

public sealed record UpdateTaskItemRequest(
    string Title,
    string? Description,
    TaskItemStatus Status,
    TaskItemPriority Priority,
    Guid? AssigneeId,
    DateTimeOffset? DueDateUtc,
    string? DefinitionOfDone = null);

public sealed record CreateCommentRequest(string Content);
