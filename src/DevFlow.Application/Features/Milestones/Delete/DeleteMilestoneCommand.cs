using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Milestones.Delete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record DeleteMilestoneCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid MilestoneId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "deleted milestone";
    public string ActivityLabel => MilestoneId.ToString();
    public Guid? ActivityTaskId => null;
}
