namespace DevFlow.Application.Features.Tasks.TimeTracking;

public sealed record TimeEntryResponse(
    Guid Id,
    Guid TaskId,
    Guid UserId,
    string UserName,
    int Minutes,
    string? Description,
    DateTimeOffset DateUtc,
    DateTimeOffset CreatedAtUtc);
