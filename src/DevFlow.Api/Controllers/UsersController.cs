using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/users")]
public sealed class UsersController(ISender sender) : ControllerBase
{
    [HttpGet("search")]
    [ProducesResponseType(typeof(List<Application.Features.Users.UserSearchResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Search(
        Guid workspaceId,
        [FromQuery] string q,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Users.SearchUsersQuery(workspaceId, q),
            cancellationToken);

        return Ok(result);
    }
}
