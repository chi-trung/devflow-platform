using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Delete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "deleted sprint";
    public string ActivityLabel => SprintId.ToString();
    public Guid? ActivityTaskId => null;
}
