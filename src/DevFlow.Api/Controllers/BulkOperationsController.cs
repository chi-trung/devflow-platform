using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/tasks/bulk")]
public sealed class BulkOperationsController(ISender sender) : ControllerBase
{
    [HttpPost("move")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkMove(
        Guid workspaceId, Guid projectId, BulkMoveRequest request, CancellationToken ct)
    {
        var count = await sender.Send(new Application.Features.BulkOperations.BulkMoveTasksCommand(
            workspaceId, projectId, request.TaskIds, request.NewStatus), ct);
        return Ok(new { moved = count });
    }

    [HttpPost("assign")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkAssign(
        Guid workspaceId, Guid projectId, BulkAssignRequest request, CancellationToken ct)
    {
        var count = await sender.Send(new Application.Features.BulkOperations.BulkAssignTasksCommand(
            workspaceId, projectId, request.TaskIds, request.AssigneeId), ct);
        return Ok(new { assigned = count });
    }

    [HttpPost("delete")]
    [ProducesResponseType(typeof(int), StatusCodes.Status200OK)]
    public async Task<IActionResult> BulkDelete(
        Guid workspaceId, Guid projectId, BulkDeleteRequest request, CancellationToken ct)
    {
        var count = await sender.Send(new Application.Features.BulkOperations.BulkDeleteTasksCommand(
            workspaceId, projectId, request.TaskIds), ct);
        return Ok(new { deleted = count });
    }
}

public sealed record BulkMoveRequest(List<Guid> TaskIds, Domain.Enums.TaskItemStatus NewStatus);
public sealed record BulkAssignRequest(List<Guid> TaskIds, Guid? AssigneeId);
public sealed record BulkDeleteRequest(List<Guid> TaskIds);
