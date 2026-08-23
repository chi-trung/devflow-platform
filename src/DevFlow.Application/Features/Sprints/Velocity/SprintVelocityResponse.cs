namespace DevFlow.Application.Features.Sprints.Velocity;

public sealed record SprintVelocityResponse(
    Guid SprintId,
    int TotalTasks,
    int CompletedTasks,
    int TotalStoryPoints,
    int CompletedStoryPoints,
    double CompletionPercent);
