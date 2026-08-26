using DevFlow.Api.Contracts.Ai;
using DevFlow.Application.Features.Ai;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/ai")]
public sealed class AiController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Generates a plan for a task using the configured LLM. The plan is
    /// grounded in the task + the project's weighted knowledge base. When the
    /// project has self-approval enabled, subtasks are created immediately.
    /// </summary>
    [HttpPost("plan")]
    [ProducesResponseType(typeof(AiPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status503ServiceUnavailable)]
    public async Task<IActionResult> Plan(
        Guid workspaceId,
        Guid projectId,
        PlanTaskRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new PlanTaskCommand(workspaceId, projectId, request.TaskId),
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Applies a previously generated pending plan: creates the subtasks and
    /// sets the parent task's Definition of Done.
    /// </summary>
    [HttpPost("{planId:guid}/apply")]
    [ProducesResponseType(typeof(AiPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Apply(
        Guid workspaceId,
        Guid projectId,
        Guid planId,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new ApplyAiPlanCommand(workspaceId, projectId, planId),
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Returns the latest plan for a task (pending or applied) so the frontend
    /// can restore the AI panel on reload.
    /// </summary>
    [HttpGet("plans/{taskId:guid}/latest")]
    [ProducesResponseType(typeof(AiPlanResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetLatest(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var plan = await sender.Send(
            new GetLatestAiPlanQuery(workspaceId, projectId, taskId),
            cancellationToken);

        return plan is null ? NoContent() : Ok(plan);
    }
}
