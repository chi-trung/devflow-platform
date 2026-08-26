namespace DevFlow.Application.Features.Epics;

public sealed record EpicResponse(
    Guid Id,
    Guid ProjectId,
    Guid? MilestoneId,
    string Name,
    string? Description,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc,
    int TotalTasks,
    int CompletedTasks,
    double CompletionPercent,
    int TotalStoryPoints,
    int CompletedStoryPoints,
    IReadOnlyList<Guid> BlockedByEpicIds);
