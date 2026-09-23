using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

/// <summary>
/// Invitation accept/decline and "my invites" — authenticated, but the caller
/// is intentionally NOT a workspace member yet, so these live outside
/// WorkspacesController's workspace-authorized routes.
/// </summary>
[Authorize]
[ApiController]
[Route("api/v1/invitations")]
public sealed class InvitationsController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Workspaces.ListInvitations.InvitationSummary>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListMine(CancellationToken cancellationToken)
    {
        var invitations = await sender.Send(
            new Application.Features.Workspaces.ListInvitations.ListMyInvitationsQuery(),
            cancellationToken);

        return Ok(invitations);
    }

    [HttpPost("{id:guid}/accept")]
    [ProducesResponseType(typeof(Application.Features.Workspaces.AcceptInvitation.AcceptInvitationResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Accept(Guid id, CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.Workspaces.AcceptInvitation.AcceptInvitationCommand(id),
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("{id:guid}/decline")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Decline(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Workspaces.DeclineInvitation.DeclineInvitationCommand(id),
            cancellationToken);

        return NoContent();
    }
}
