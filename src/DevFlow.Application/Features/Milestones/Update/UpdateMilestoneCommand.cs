using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateMilestoneCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid MilestoneId,
    string Name,
    string? Description,
    DateTimeOffset? TargetDateUtc,
    MilestoneStatus Status) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "updated milestone";
    public string ActivityLabel => Name;
    public Guid? ActivityTaskId => null;
}
