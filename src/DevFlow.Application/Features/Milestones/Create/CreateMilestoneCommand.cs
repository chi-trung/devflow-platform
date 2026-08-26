using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateMilestoneCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Name,
    string? Description,
    DateTimeOffset? TargetDateUtc) : IRequest<MilestoneCreatedResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "created milestone";
    public string ActivityLabel => Name;
    public Guid? ActivityTaskId => null;
}

public sealed record MilestoneCreatedResponse(Guid Id);
