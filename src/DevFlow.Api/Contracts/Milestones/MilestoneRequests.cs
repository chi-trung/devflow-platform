namespace DevFlow.Api.Contracts.Milestones;

public sealed record CreateMilestoneRequest(
    string Name,
    string? Description,
    DateTimeOffset? TargetDateUtc);

public sealed record UpdateMilestoneRequest(
    string Name,
    string? Description,
    DateTimeOffset? TargetDateUtc,
    string Status);
