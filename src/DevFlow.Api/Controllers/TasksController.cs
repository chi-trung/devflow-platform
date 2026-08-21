using DevFlow.Api.Contracts.Tasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/tasks")]
public sealed class TasksController(ISender sender) : ControllerBase
{
    [HttpPost]
    [ProducesResponseType(typeof(Application.Features.Tasks.Create.TaskItemCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Create(
        Guid workspaceId,
        Guid projectId,
        CreateTaskItemRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Tasks.Create.CreateTaskItemCommand(
            workspaceId,
            projectId,
            request.Title,
            request.Description,
            request.Priority,
            request.DueDateUtc);

        var taskId = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, taskId);
    }

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Tasks.TaskItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        Guid projectId,
        [FromQuery] Domain.Enums.TaskItemStatus? status,
        CancellationToken cancellationToken)
    {
        var tasks = await sender.Send(
            new Application.Features.Tasks.List.ListTaskItemsQuery(workspaceId, projectId, status),
            cancellationToken);

        return Ok(tasks);
    }

    [HttpPatch("{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Update(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        UpdateTaskItemRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Tasks.Update.UpdateTaskItemCommand(
            workspaceId,
            projectId,
            taskId,
            request.Title,
            request.Description,
            request.Status,
            request.Priority,
            request.AssigneeId,
            request.DueDateUtc);

        await sender.Send(command, cancellationToken);

        return NoContent();
    }

    [HttpDelete("{taskId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.Delete.DeleteTaskItemCommand(workspaceId, projectId, taskId),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("{taskId:guid}/attachments")]
    [ProducesResponseType(typeof(IReadOnlyList<Application.Features.Tasks.Attachments.TaskAttachmentResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListAttachments(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var attachments = await sender.Send(
            new Application.Features.Tasks.Attachments.ListTaskAttachmentsQuery(workspaceId, projectId, taskId),
            cancellationToken);

        return Ok(attachments);
    }

    [HttpPost("{taskId:guid}/attachments")]
    [ProducesResponseType(typeof(Application.Features.Tasks.Attachments.TaskAttachmentResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UploadAttachment(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        IFormFile file,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
        {
            return BadRequest(new ProblemDetails { Title = "No file uploaded." });
        }

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream, cancellationToken);

        var command = new Application.Features.Tasks.Attachments.UploadTaskAttachmentCommand(
            workspaceId,
            projectId,
            taskId,
            file.FileName,
            file.ContentType ?? "application/octet-stream",
            file.Length,
            memoryStream.ToArray());

        var result = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("{taskId:guid}/attachments/{attachmentId:guid}/download")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadAttachment(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        Guid attachmentId,
        CancellationToken cancellationToken)
    {
        var fileResult = await sender.Send(
            new Application.Features.Tasks.Attachments.DownloadTaskAttachmentQuery(workspaceId, projectId, taskId, attachmentId),
            cancellationToken);

        return File(fileResult.Data, fileResult.ContentType, fileResult.FileName);
    }

    [HttpDelete("{taskId:guid}/attachments/{attachmentId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DeleteAttachment(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        Guid attachmentId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.Attachments.DeleteTaskAttachmentCommand(workspaceId, projectId, taskId, attachmentId),
            cancellationToken);

        return NoContent();
    }
}
