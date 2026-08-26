using DevFlow.Api.Contracts.Milestones;
using DevFlow.Application.Features.Milestones.Create;
using DevFlow.Application.Features.Milestones.Delete;
using DevFlow.Application.Features.Milestones.List;
using DevFlow.Application.Features.Milestones.Update;
using DevFlow.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/milestones")]
public sealed class MilestonesController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(MilestoneCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateMilestoneRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new CreateMilestoneCommand(
                workspaceId,
                projectId,
                request.Name,
                request.Description,
                request.TargetDateUtc),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, response);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Milestones.MilestoneResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
    {
        var milestones = await sender.Send(
            new ListMilestonesQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(milestones);
    }

    [HttpPut("{milestoneId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        Guid milestoneId,
        UpdateMilestoneRequest request,
        CancellationToken cancellationToken)
    {
        if (!Enum.TryParse<MilestoneStatus>(request.Status, ignoreCase: true, out var status))
        {
            return BadRequest($"Invalid milestone status '{request.Status}'.");
        }

        await sender.Send(
            new UpdateMilestoneCommand(
                workspaceId,
                projectId,
                milestoneId,
                request.Name,
                request.Description,
                request.TargetDateUtc,
                status),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("{milestoneId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid milestoneId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new DeleteMilestoneCommand(workspaceId, projectId, milestoneId),
            cancellationToken);

        return NoContent();
    }
}
