namespace DevFlow.Api.Contracts.Epics;

public sealed record CreateEpicRequest(
    string Name,
    string? Description,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc);

public sealed record UpdateEpicRequest(
    string Name,
    string? Description,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc);

public sealed record AddEpicDependencyRequest(Guid BlockedByEpicId);
