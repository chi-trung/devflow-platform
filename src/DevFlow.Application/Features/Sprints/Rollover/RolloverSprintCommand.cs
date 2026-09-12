using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Rollover;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
// IProjectEvent with the default empty ActivityVerb: the behavior pipeline
// invalidates the project's cached queries (tasks board, velocity history —
// rollover moves every unfinished task's SprintId) and wakes realtime board
// clients, while ActivityBehavior stays silent because the handler already
// writes a precise per-task activity entry.
public sealed record RolloverSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId) : IRequest<RolloverResult>, IWorkspaceRequest, IProjectEvent
{
}

public sealed record RolloverResult(
    int RolledOverTasks,
    int CompletedTasks,
    Guid? TargetSprintId);
