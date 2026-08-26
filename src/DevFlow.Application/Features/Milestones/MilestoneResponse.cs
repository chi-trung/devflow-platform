namespace DevFlow.Application.Features.Milestones;

public sealed record MilestoneResponse(
    Guid Id,
    Guid ProjectId,
    string Name,
    string? Description,
    DateTimeOffset? TargetDateUtc,
    string Status);
