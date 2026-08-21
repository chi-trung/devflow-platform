using DevFlow.Api.Contracts.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/tasks/{taskId:guid}/comments")]
public sealed class CommentsController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(Application.Features.Comments.CommentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CreateCommentRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Comments.Create.CreateCommentCommand(
            workspaceId,
            projectId,
            taskId,
            request.Content);

        var comment = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, comment);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Comments.CommentResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var comments = await sender.Send(
            new Application.Features.Comments.List.ListCommentsQuery(workspaceId, projectId, taskId),
            cancellationToken);

        return Ok(comments);
    }

    [HttpDelete("{commentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        Guid commentId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Comments.Delete.DeleteCommentCommand(workspaceId, projectId, taskId, commentId),
            cancellationToken);

        return NoContent();
    }
}
