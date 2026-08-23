using DevFlow.Application.Features.Tasks.Estimation;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

// Sprint 18 B18.3 — story point estimation endpoint.
[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/tasks/{taskId:guid}/estimation")]
public sealed class TaskEstimationController(ISender sender) : ControllerBase
{
    public sealed record SetEstimationRequest(int? StoryPoints);

    [HttpPut]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> SetEstimation(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        SetEstimationRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new SetTaskEstimationCommand(workspaceId, projectId, taskId, request.StoryPoints),
            cancellationToken);

        return NoContent();
    }
}
