using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/export")]
public sealed class ExportController(ISender sender) : ControllerBase
{
    [HttpGet("tasks")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> ExportTasks(
        Guid workspaceId, Guid projectId, [FromQuery] string format = "csv", CancellationToken ct = default)
    {
        var result = await sender.Send(
            new Application.Features.Export.ExportProjectTasksQuery(workspaceId, projectId, format), ct);

        return File(result.Data, result.ContentType, result.FileName);
    }
}
