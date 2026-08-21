namespace DevFlow.Application.Features.Sprints;

public sealed record SprintResponse(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Goal,
    string Status,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc,
    DateTimeOffset? CompletedAtUtc);
