using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/reporting")]
public sealed class ReportingController(ISender sender) : ControllerBase
{
    [HttpGet("burndown")]
    [ProducesResponseType(typeof(Application.Features.Reporting.BurndownResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetBurndown(
        Guid workspaceId,
        Guid projectId,
        [FromQuery] DateOnly startDate,
        [FromQuery] DateOnly endDate,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Reporting.GetBurndownQuery(workspaceId, projectId, startDate, endDate),
            cancellationToken);

        return Ok(result);
    }

    [HttpGet("velocity")]
    [ProducesResponseType(typeof(Application.Features.Reporting.VelocityResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetVelocity(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Reporting.GetVelocityQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(result);
    }
}

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/reporting")]
public sealed class WorkspaceReportingController(ISender sender) : ControllerBase
{
    [HttpGet("team")]
    [ProducesResponseType(typeof(Application.Features.Reporting.TeamReportResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTeamReport(
        Guid workspaceId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Reporting.GetTeamReportQuery(workspaceId),
            cancellationToken);

        return Ok(result);
    }
}
