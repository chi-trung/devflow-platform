using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/import")]
public sealed class ImportController(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork,
    ISender sender) : ControllerBase
{
    [HttpPost("tasks")]
    [Consumes("application/json", "text/csv")]
    [ProducesResponseType(typeof(ImportResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportTasks(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var contentType = Request.ContentType ?? "";

        if (contentType.Contains("text/csv"))
        {
            return await ImportFromCsv(projectId, cancellationToken);
        }

        return await ImportFromJson(projectId, cancellationToken);
    }

    [HttpPost("backup")]
    [Consumes("application/json")]
    [ProducesResponseType(typeof(ImportBackupResultResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ImportBackup(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);

        if (string.IsNullOrWhiteSpace(body))
        {
            return BadRequest("No backup data provided.");
        }

        var result = await sender.Send(
            new Application.Features.Import.ImportProjectBackupCommand(workspaceId, projectId, body),
            cancellationToken);

        return Ok(new ImportBackupResultResponse(
            result.TasksImported,
            result.EpicsImported,
            result.SprintsImported,
            result.CommentsImported,
            result.Errors));
    }

    private async Task<IActionResult> ImportFromJson(Guid projectId, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body);
        var body = await reader.ReadToEndAsync(cancellationToken);

        List<ImportTaskItem>? items;
        try
        {
            items = JsonSerializer.Deserialize<List<ImportTaskItem>>(body, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true,
            });
        }
        catch
        {
            return BadRequest("Invalid JSON format.");
        }

        if (items is null || items.Count == 0)
        {
            return BadRequest("No tasks to import.");
        }

        return await ProcessImport(projectId, items, cancellationToken);
    }

    private async Task<IActionResult> ImportFromCsv(Guid projectId, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(cancellationToken);

        var lines = body.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2)
        {
            return BadRequest("CSV must have a header row and at least one data row.");
        }

        var header = lines[0].Split(',').Select(h => h.Trim().ToLowerInvariant()).ToArray();
        var titleIndex = Array.IndexOf(header, "title");
        var descIndex = Array.IndexOf(header, "description");
        var statusIndex = Array.IndexOf(header, "status");
        var priorityIndex = Array.IndexOf(header, "priority");

        if (titleIndex < 0)
        {
            return BadRequest("CSV must have a 'title' column.");
        }

        var items = new List<ImportTaskItem>();

        for (int i = 1; i < lines.Length; i++)
        {
            var cols = lines[i].Split(',');
            if (cols.Length <= titleIndex) continue;

            var title = cols[titleIndex].Trim().Trim('"');
            if (string.IsNullOrWhiteSpace(title)) continue;

            items.Add(new ImportTaskItem
            {
                Title = title,
                Description = descIndex >= 0 && cols.Length > descIndex ? cols[descIndex].Trim().Trim('"') : null,
                Status = statusIndex >= 0 && cols.Length > statusIndex ? cols[statusIndex].Trim() : "Backlog",
                Priority = priorityIndex >= 0 && cols.Length > priorityIndex ? cols[priorityIndex].Trim() : "Medium",
            });
        }

        if (items.Count == 0)
        {
            return BadRequest("No valid tasks found in CSV.");
        }

        return await ProcessImport(projectId, items, cancellationToken);
    }

    private async Task<IActionResult> ProcessImport(
        Guid projectId,
        List<ImportTaskItem> items,
        CancellationToken cancellationToken)
    {
        int imported = 0;
        int skipped = 0;
        var errors = new List<string>();

        foreach (var item in items)
        {
            if (string.IsNullOrWhiteSpace(item.Title))
            {
                skipped++;
                continue;
            }

            if (!Enum.TryParse<TaskItemStatus>(item.Status, true, out var status))
            {
                errors.Add($"Invalid status '{item.Status}' for task '{item.Title}'.");
                skipped++;
                continue;
            }

            if (!Enum.TryParse<TaskItemPriority>(item.Priority, true, out var priority))
            {
                errors.Add($"Invalid priority '{item.Priority}' for task '{item.Title}'.");
                skipped++;
                continue;
            }

            var task = Domain.Entities.TaskItem.Create(
                projectId,
                item.Title.Trim(),
                item.Description?.Trim(),
                priority);

            if (status != TaskItemStatus.Backlog)
            {
                task.ChangeStatus(status);
            }

            await taskItemRepository.AddAsync(task, cancellationToken);
            imported++;
        }

        if (imported > 0)
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return Ok(new ImportResult(imported, skipped, errors));
    }

    public sealed class ImportTaskItem
    {
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public string Status { get; set; } = "Backlog";
        public string Priority { get; set; } = "Medium";
    }

    public sealed record ImportResult(
        int Imported,
        int Skipped,
        IReadOnlyList<string> Errors);

    public sealed record ImportBackupResultResponse(
        int TasksImported,
        int EpicsImported,
        int SprintsImported,
        int CommentsImported,
        IReadOnlyList<string> Errors);
}
