using DevFlow.Api.Contracts.Ai;
using DevFlow.Application.Features.Ai.Execute;
using DevFlow.Application.Features.Ai.Suggest;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

/// <summary>
/// Workspace-level AI assistant endpoint. Lives on its own controller (not the
/// project-scoped <see cref="AiController"/>) because the project id is optional:
/// the assistant can create tasks in the active project, or even create a whole
/// new workspace from a bare prompt.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/ai")]
public sealed class AiAssistantController(ISender sender) : ControllerBase
{
    /// <summary>
    /// Turns a natural-language prompt into concrete actions (create task,
    /// sprint, project; set deadline, priority; assign…) and executes them.
    /// projectId is optional — when omitted the assistant uses the first project
    /// in the workspace unless the prompt names one.
    /// </summary>
    [HttpPost("execute")]
    [ProducesResponseType(typeof(AiExecuteResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Execute(
        Guid workspaceId,
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? sprintId,
        [FromQuery] Guid? epicId,
        AiExecuteRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new AiExecuteCommand(workspaceId, projectId, request.Prompt, request.PageContext, sprintId, epicId),
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Returns context-aware prompt suggestions based on real project data
    /// (current sprint, epics, unassigned tasks…). The frontend shows these as
    /// chips when the assistant opens so the user has ready-made, grounded
    /// prompts instead of generic static ones.
    /// </summary>
    [HttpPost("suggest")]
    [ProducesResponseType(typeof(List<AiSuggestion>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Suggest(
        Guid workspaceId,
        [FromQuery] Guid? projectId,
        [FromQuery] Guid? epicId,
        AiSuggestRequest request,
        CancellationToken cancellationToken)
    {
        var suggestions = await sender.Send(
            new AiSuggestCommand(workspaceId, projectId, request.PageContext, epicId),
            cancellationToken);

        return Ok(suggestions);
    }

    /// <summary>
    /// Executes a single AI-proposed action that the user accepted from the
    /// review list. The action was originally returned as "pending" by
    /// <see cref="Execute"/>; confirming re-runs it through the same shared
    /// executor so the result is identical to direct execution.
    /// </summary>
    [HttpPost("execute/confirm")]
    [ProducesResponseType(typeof(ExecutedAction), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Confirm(
        Guid workspaceId,
        [FromQuery] Guid? projectId,
        AiExecuteConfirmRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new AiExecuteConfirmCommand(workspaceId, projectId, request.Action),
            cancellationToken);

        return Ok(result);
    }
}
