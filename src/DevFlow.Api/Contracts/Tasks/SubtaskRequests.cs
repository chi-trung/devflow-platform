using DevFlow.Domain.Enums;

namespace DevFlow.Api.Contracts.Tasks;

public sealed record CreateSubtaskRequest(
    string Title,
    string? Description,
    TaskItemPriority Priority);
