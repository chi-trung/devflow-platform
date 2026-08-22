using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/dashboard")]
public sealed class DashboardController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(Application.Features.Dashboard.DashboardResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDashboard(Guid workspaceId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Dashboard.GetDashboardQuery(workspaceId),
            cancellationToken);

        return Ok(result);
    }
}
