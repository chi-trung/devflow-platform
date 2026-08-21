using DevFlow.Domain.Enums;

namespace DevFlow.Api.Contracts.Tasks;

public sealed record CreateTaskItemRequest(
    string Title,
    string? Description,
    TaskItemPriority Priority,
    DateTimeOffset? DueDateUtc);

public sealed record UpdateTaskItemRequest(
    string Title,
    string? Description,
    TaskItemStatus Status,
    TaskItemPriority Priority,
    Guid? AssigneeId,
    DateTimeOffset? DueDateUtc);

public sealed record CreateCommentRequest(string Content);
