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
}
