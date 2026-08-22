namespace DevFlow.Application.Features.Tasks.Dependencies;

public sealed record TaskDependencyResponse(
    Guid Id,
    Guid BlockedTaskId,
    Guid BlockerTaskId,
    string BlockerTitle,
    string BlockerStatus,
    bool IsResolved);
