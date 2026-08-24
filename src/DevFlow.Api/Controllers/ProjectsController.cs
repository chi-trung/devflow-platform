using DevFlow.Api.Contracts.Projects;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects")]
public sealed class ProjectsController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(ProjectCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        CreateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Projects.Create.CreateProjectCommand(
            workspaceId,
            request.Name,
            request.Key,
            request.Description);

        var projectId = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new ProjectCreatedResponse(projectId));
    }

    [HttpGet]
    [ProducesResponseType(typeof(Application.Common.Models.PagedResult<Application.Features.Projects.ProjectResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(
            new Application.Features.Projects.List.ListProjectsQuery(workspaceId, page, pageSize),
            cancellationToken);

        Response.Headers.Append("X-Total-Count", result.TotalCount.ToString());
        Response.Headers.Append("X-Total-Pages", result.TotalPages.ToString());
        Response.Headers.Append("X-Current-Page", result.Page.ToString());

        return Ok(result);
    }

    [HttpGet("{projectId:guid}")]
    [ProducesResponseType(typeof(Application.Features.Projects.ProjectResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var project = await sender.Send(
            new Application.Features.Projects.GetById.GetProjectByIdQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(project);
    }

    [HttpPatch("{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        UpdateProjectRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Projects.Update.UpdateProjectCommand(
            workspaceId,
            projectId,
            request.Name,
            request.Description);

        await sender.Send(command, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{projectId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Archive(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Projects.Archive.ArchiveProjectCommand(workspaceId, projectId),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("{projectId:guid}/restore")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Restore(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Projects.Restore.RestoreProjectCommand(workspaceId, projectId),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("{projectId:guid}/activities")]
    [ProducesResponseType(typeof(Application.Features.Activities.ActivityResponsePage), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ListActivities(
        Guid workspaceId,
        Guid projectId,
        [FromQuery] Guid? actorUserId = null,
        [FromQuery] Guid? taskItemId = null,
        [FromQuery] string? action = null,
        [FromQuery] DateTimeOffset? from = null,
        [FromQuery] DateTimeOffset? to = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(
            new Application.Features.Activities.ListActivitiesQuery(
                workspaceId,
                projectId,
                actorUserId,
                taskItemId,
                action,
                from,
                to,
                Math.Clamp(pageSize, 1, 200),
                page),
            cancellationToken);

        return Ok(result);
    }
}
