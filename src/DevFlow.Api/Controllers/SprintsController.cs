using DevFlow.Api.Contracts.Sprints;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/sprints")]
public sealed class SprintsController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(SprintCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateSprintRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Sprints.Create.CreateSprintCommand(
            workspaceId,
            projectId,
            request.Name,
            request.Goal);

        var sprint = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new SprintCreatedResponse(sprint.Id));
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Sprints.SprintResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
    {
        var sprints = await sender.Send(
            new Application.Features.Sprints.List.ListSprintsQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(sprints);
    }

    [HttpPost("{sprintId:guid}/start")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Start(
        Guid workspaceId,
        Guid projectId,
        Guid sprintId,
        StartSprintRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Sprints.Start.StartSprintCommand(
            workspaceId,
            projectId,
            sprintId,
            request.StartDateUtc,
            request.EndDateUtc);

        await sender.Send(command, cancellationToken);

        return NoContent();
    }

    [HttpPost("{sprintId:guid}/complete")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Complete(
        Guid workspaceId,
        Guid projectId,
        Guid sprintId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Sprints.Complete.CompleteSprintCommand(workspaceId, projectId, sprintId),
            cancellationToken);

        return NoContent();
    }

    [HttpPut("{sprintId:guid}/tasks/{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> AssignTask(
        Guid workspaceId,
        Guid projectId,
        Guid sprintId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Sprints.AssignTask.AssignTaskToSprintCommand(
                workspaceId, projectId, sprintId, taskId),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("{sprintId:guid}/velocity")]
    [ProducesResponseType(typeof(Application.Features.Sprints.Velocity.SprintVelocityResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Velocity(
        Guid workspaceId,
        Guid projectId,
        Guid sprintId,
        CancellationToken cancellationToken)
    {
        var velocity = await sender.Send(
            new Application.Features.Sprints.Velocity.GetSprintVelocityQuery(workspaceId, projectId, sprintId),
            cancellationToken);

        return Ok(velocity);
    }

    [HttpDelete("{sprintId:guid}/tasks/{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> RemoveTask(
        Guid workspaceId,
        Guid projectId,
        Guid sprintId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Sprints.RemoveTask.RemoveTaskFromSprintCommand(
                workspaceId, projectId, sprintId, taskId),
            cancellationToken);

        return NoContent();
    }
}
