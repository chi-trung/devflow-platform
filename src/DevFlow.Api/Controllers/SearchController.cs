using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/search")]
public sealed class SearchController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(Application.Features.Search.SearchResult), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search(
        Guid workspaceId,
        [FromQuery] string? q,
        [FromQuery] string? status,
        [FromQuery] string? priority,
        [FromQuery] Guid? assigneeId,
        [FromQuery] Guid? labelId,
        [FromQuery] DateTime? dueBefore,
        [FromQuery] DateTime? dueAfter,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Search.SearchQuery(
                workspaceId, q ?? string.Empty, status, priority, assigneeId, labelId, dueBefore, dueAfter),
            cancellationToken);

        return Ok(result);
    }
}
