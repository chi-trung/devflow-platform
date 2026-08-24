using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Delete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteEpicCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "deleted epic";
    public string ActivityLabel => EpicId.ToString();
    public Guid? ActivityTaskId => null;
}
