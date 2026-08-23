using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Rollover;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record RolloverSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId) : IRequest<RolloverResult>, IWorkspaceRequest
{
}

public sealed record RolloverResult(
    int RolledOverTasks,
    int CompletedTasks,
    Guid? TargetSprintId);
