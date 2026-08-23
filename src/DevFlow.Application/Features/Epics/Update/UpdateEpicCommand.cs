using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateEpicCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId,
    string Name,
    string? Description,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "updated epic";
    public string ActivityLabel => Name;
    public Guid? ActivityTaskId => null;
}
