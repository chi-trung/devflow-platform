using DevFlow.Application.Features.Outbox;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

/// <summary>
/// Admin outbox DLQ endpoints — list dead-lettered webhook messages for a
/// workspace and replay (reset retry state on) one. Both are Admin-gated via
/// the <c>[RequireWorkspaceRole(Admin)]</c> commands they dispatch.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/outbox")]
public sealed class OutboxController(ISender sender) : ControllerBase
{
    [HttpGet("dead-letter")]
    [ProducesResponseType(typeof(IReadOnlyList<DeadLetterMessageDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> GetDeadLetter(
        Guid workspaceId,
        [FromQuery] int batchSize = 100,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(
            new GetDeadLetterMessagesQuery(workspaceId, Math.Clamp(batchSize, 1, 500)),
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("{messageId:guid}/replay")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Replay(
        Guid workspaceId,
        Guid messageId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new ReplayOutboxMessageCommand(workspaceId, messageId),
            cancellationToken);

        return NoContent();
    }
}
