using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateEpicCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Name,
    string? Description,
    DateTimeOffset? StartDateUtc,
    DateTimeOffset? EndDateUtc) : IRequest<EpicCreatedResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "created epic";
    public string ActivityLabel => Name;
    public Guid? ActivityTaskId => null;
}

public sealed record EpicCreatedResponse(Guid Id);
