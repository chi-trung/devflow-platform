using DevFlow.Api.Contracts.Tasks;
using DevFlow.Application.Features.Tasks.Subtasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

// Owns the task-hierarchy surface (Sprint 18 B18.2). Kept separate from
// TasksController so parallel agents can work on both without merge conflicts.
[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/tasks/{parentTaskId:guid}/subtasks")]
public sealed class SubtasksController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(SubtaskCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        Guid parentTaskId,
        CreateSubtaskRequest request,
        CancellationToken cancellationToken)
    {
        var subtask = await sender.Send(
            new CreateSubtaskCommand(
                workspaceId,
                projectId,
                parentTaskId,
                request.Title,
                request.Description,
                request.Priority),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, subtask);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Tasks.TaskItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        Guid projectId,
        Guid parentTaskId,
        CancellationToken cancellationToken)
    {
        var subtasks = await sender.Send(
            new ListSubtasksQuery(workspaceId, projectId, parentTaskId),
            cancellationToken);

        return Ok(subtasks);
    }

    [HttpDelete("{subtaskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Detach(
        Guid workspaceId,
        Guid projectId,
        Guid parentTaskId,
        Guid subtaskId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new DetachSubtaskCommand(workspaceId, projectId, parentTaskId, subtaskId),
            cancellationToken);

        return NoContent();
    }
}
