using DevFlow.Api.Contracts.Workspaces;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces")]
public sealed class WorkspacesController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(WorkspaceCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Create(
        CreateWorkspaceRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Workspaces.Create.CreateWorkspaceCommand(
            request.Name,
            request.Slug,
            request.Description);

        var workspaceId = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new WorkspaceCreatedResponse(workspaceId));
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Workspaces.List.WorkspaceResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var workspaces = await sender.Send(
            new Application.Features.Workspaces.List.ListWorkspacesQuery(),
            cancellationToken);

        return Ok(workspaces);
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(Application.Features.Workspaces.List.WorkspaceResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var workspace = await sender.Send(
            new Application.Features.Workspaces.GetById.GetWorkspaceByIdQuery(id),
            cancellationToken);

        return Ok(workspace);
    }

    [HttpPost("{id:guid}/members")]
    [ProducesResponseType(typeof(Application.Features.Workspaces.InviteMembers.MemberResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> InviteMember(
        Guid id,
        InviteMemberRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Workspaces.InviteMembers.InviteMemberCommand(
            id,
            request.Email,
            request.Role);

        var member = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, member);
    }
}
