using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Applies a previously generated plan: creates the proposed subtasks under the
/// parent task and sets the task's Definition of Done. Only a pending plan can
/// be applied; applying marks it Applied and supersedes other pending plans.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ApplyAiPlanCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid PlanId) : IRequest<AiPlanResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "applied AI plan for";
    public string ActivityLabel => "task";
    public Guid? ActivityTaskId => null;
}
