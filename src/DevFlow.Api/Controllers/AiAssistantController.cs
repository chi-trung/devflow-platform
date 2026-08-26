using DevFlow.Api.Contracts.Ai;
using DevFlow.Application.Features.Ai.Execute;
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
        AiExecuteRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new AiExecuteCommand(workspaceId, projectId, request.Prompt, request.PageContext),
            cancellationToken);

        return Ok(response);
    }
}
