namespace DevFlow.Api.Contracts.Tasks;

public sealed record AddDependencyRequest(Guid BlockerTaskId);

public sealed record LogTimeEntryRequest(
    int Minutes,
    string? Description,
    DateTimeOffset? DateUtc);
