namespace DevFlow.Application.Features.Ai;

public sealed record AiPlanResponse(
    Guid Id,
    Guid TaskId,
    Guid ProjectId,
    string Status,
    bool Applied,
    string? Summary,
    IReadOnlyList<string> Steps,
    IReadOnlyList<AiPlanSubtaskResponse> Subtasks,
    IReadOnlyList<string> DefinitionOfDone,
    DateTimeOffset CreatedAtUtc);

public sealed record AiPlanSubtaskResponse(
    string Title,
    string? Description,
    string Priority);
