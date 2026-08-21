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
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Projects.ProjectResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, CancellationToken cancellationToken)
    {
        var projects = await sender.Send(
            new Application.Features.Projects.List.ListProjectsQuery(workspaceId),
            cancellationToken);

        return Ok(projects);
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
}
