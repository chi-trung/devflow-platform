namespace DevFlow.Api.Contracts.Sprints;

public sealed record CreateSprintRequest(string Name, string? Goal);

public sealed record SprintCreatedResponse(Guid Id);
public sealed record UpdateSprintRequest(string Name, string? Goal);

public sealed record StartSprintRequest(DateTimeOffset StartDateUtc, DateTimeOffset EndDateUtc);
