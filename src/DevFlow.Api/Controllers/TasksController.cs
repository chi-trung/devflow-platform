using DevFlow.Api.Contracts.Tasks;
using DevFlow.Application.Features.Tasks.Reorder;
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
    [ProducesResponseType(typeof(Application.Common.Models.PagedResult<Application.Features.Tasks.TaskItemResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(
        Guid workspaceId,
        Guid projectId,
        [FromQuery] Domain.Enums.TaskItemStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        var result = await sender.Send(
            new Application.Features.Tasks.List.ListTaskItemsQuery(workspaceId, projectId, status, page, pageSize),
            cancellationToken);

        Response.Headers.Append("X-Total-Count", result.TotalCount.ToString());
        Response.Headers.Append("X-Total-Pages", result.TotalPages.ToString());
        Response.Headers.Append("X-Current-Page", result.Page.ToString());

        return Ok(result);
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

    // ===== TASK DEPENDENCIES =====

    [HttpGet("{taskId:guid}/dependencies")]
    [ProducesResponseType(typeof(List<Application.Features.Tasks.Dependencies.TaskDependencyResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetDependencies(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var dependencies = await sender.Send(
            new Application.Features.Tasks.Dependencies.GetTaskDependenciesQuery(workspaceId, projectId, taskId),
            cancellationToken);

        return Ok(dependencies);
    }

    [HttpPost("{taskId:guid}/dependencies")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> AddDependency(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        AddDependencyRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.Dependencies.AddTaskDependencyCommand(workspaceId, projectId, taskId, request.BlockerTaskId),
            cancellationToken);

        return NoContent();
    }

    [HttpDelete("{taskId:guid}/dependencies/{dependencyId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> RemoveDependency(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        Guid dependencyId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.Dependencies.RemoveTaskDependencyCommand(workspaceId, projectId, taskId, dependencyId),
            cancellationToken);

        return NoContent();
    }

    // ===== TIME TRACKING =====

    [HttpGet("{taskId:guid}/time-entries")]
    [ProducesResponseType(typeof(List<Application.Features.Tasks.TimeTracking.TimeEntryResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetTimeEntries(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        CancellationToken cancellationToken)
    {
        var entries = await sender.Send(
            new Application.Features.Tasks.TimeTracking.GetTimeEntriesQuery(workspaceId, projectId, taskId),
            cancellationToken);

        return Ok(entries);
    }

    [HttpPost("{taskId:guid}/time-entries")]
    [ProducesResponseType(typeof(Guid), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> LogTime(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        LogTimeEntryRequest request,
        CancellationToken cancellationToken)
    {
        var entryId = await sender.Send(
            new Application.Features.Tasks.TimeTracking.LogTimeEntryCommand(
                workspaceId, projectId, taskId, request.Minutes, request.Description, request.DateUtc ?? DateTimeOffset.UtcNow),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, entryId);
    }

    [HttpDelete("{taskId:guid}/time-entries/{entryId:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeleteTimeEntry(
        Guid workspaceId,
        Guid projectId,
        Guid taskId,
        Guid entryId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.TimeTracking.DeleteTimeEntryCommand(workspaceId, projectId, taskId, entryId),
            cancellationToken);

        return NoContent();
    }

    [HttpPut("reorder")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Reorder(
        Guid workspaceId,
        Guid projectId,
        [FromBody] ReorderTasksRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Tasks.Reorder.ReorderTasksCommand(
                workspaceId, projectId, request.Tasks),
            cancellationToken);

        return NoContent();
    }

    public sealed record ReorderTasksRequest(IReadOnlyList<ReorderTaskItem> Tasks);
}
