using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/labels")]
public sealed class LabelsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Labels.LabelResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetLabels(Guid projectId, CancellationToken cancellationToken)
    {
        var labels = await sender.Send(
            new Application.Features.Labels.GetLabelsQuery(projectId),
            cancellationToken);

        return Ok(labels);
    }

    [HttpPost]
    [ProducesResponseType(typeof(Application.Features.Labels.LabelResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> CreateLabel(
        Guid projectId,
        CreateLabelRequest request,
        CancellationToken cancellationToken)
    {
        var label = await sender.Send(
            new Application.Features.Labels.CreateLabelCommand(projectId, request.Name, request.Color),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, label);
    }

    [HttpDelete("{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteLabel(
        Guid projectId,
        Guid labelId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Labels.DeleteLabelCommand(projectId, labelId),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("tasks/{taskId:guid}/assign/{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> AssignLabelToTask(
        Guid taskId,
        Guid labelId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Labels.AssignLabelToTaskCommand(taskId, labelId),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("tasks/{taskId:guid}/remove/{labelId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveLabelFromTask(
        Guid taskId,
        Guid labelId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Labels.RemoveLabelFromTaskCommand(taskId, labelId),
            cancellationToken);

        return NoContent();
    }
}

public sealed record CreateLabelRequest(string Name, string Color);
