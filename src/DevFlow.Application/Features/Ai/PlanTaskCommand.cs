using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Ai;

/// <summary>
/// Generates a plan for a task using the configured LLM, grounded in the task's
/// description, status, and the project's weighted knowledge base. The generated
/// plan is persisted so it can be reviewed (pending), applied, or superseded.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record PlanTaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<AiPlanResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "generated AI plan for";
    public string ActivityLabel => "task";
    public Guid? ActivityTaskId => TaskId;
}
