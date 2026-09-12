using System.Text;
using System.Text.Json;
using DevFlow.Application.Features.Import;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

// [Authorize] is load-bearing, not decoration: this controller has no
// fallback auth policy, so before this attribute the import endpoints were
// anonymous writes — anyone could create tasks in any project by id.
[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/import")]
public sealed class ImportController(ISender sender) : ControllerBase
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
            return await ImportFromCsv(workspaceId, projectId, cancellationToken);
        }

        return await ImportFromJson(workspaceId, projectId, cancellationToken);
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
            new ImportProjectBackupCommand(workspaceId, projectId, body),
            cancellationToken);

        return Ok(new ImportBackupResultResponse(
            result.TasksImported,
            result.EpicsImported,
            result.SprintsImported,
            result.CommentsImported,
            result.TimeEntriesImported,
            result.Errors));
    }

    private async Task<IActionResult> ImportFromJson(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
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

        return await ProcessImport(workspaceId, projectId, items, cancellationToken);
    }

    private async Task<IActionResult> ImportFromCsv(Guid workspaceId, Guid projectId, CancellationToken cancellationToken)
    {
        using var reader = new StreamReader(Request.Body, Encoding.UTF8);
        var body = await reader.ReadToEndAsync(cancellationToken);

        var lines = SplitCsvLines(body);
        if (lines.Count < 2)
        {
            return BadRequest("CSV must have a header row and at least one data row.");
        }

        var header = SplitCsvRow(lines[0]).Select(h => h.Trim().ToLowerInvariant()).ToArray();
        var titleIndex = Array.IndexOf(header, "title");
        var descIndex = Array.IndexOf(header, "description");
        var statusIndex = Array.IndexOf(header, "status");
        var priorityIndex = Array.IndexOf(header, "priority");

        if (titleIndex < 0)
        {
            return BadRequest("CSV must have a 'title' column.");
        }

        var items = new List<ImportTaskItem>();

        for (int i = 1; i < lines.Count; i++)
        {
            var cols = SplitCsvRow(lines[i]);
            if (cols.Count <= titleIndex) continue;

            var title = cols[titleIndex].Trim();
            if (string.IsNullOrWhiteSpace(title)) continue;

            items.Add(new ImportTaskItem
            {
                Title = title,
                Description = descIndex >= 0 && cols.Count > descIndex ? cols[descIndex].Trim() : null,
                Status = statusIndex >= 0 && cols.Count > statusIndex ? cols[statusIndex].Trim() : "Backlog",
                Priority = priorityIndex >= 0 && cols.Count > priorityIndex ? cols[priorityIndex].Trim() : "Medium",
            });
        }

        if (items.Count == 0)
        {
            return BadRequest("No valid tasks found in CSV.");
        }

        return await ProcessImport(workspaceId, projectId, items, cancellationToken);
    }

    /// <summary>
    /// Splits a CSV body into logical rows. A naive '\n' split breaks on
    /// quoted fields containing newlines, which the task export emits
    /// verbatim (it only escapes quotes, never newlines).
    /// </summary>
    private static List<string> SplitCsvLines(string body)
    {
        var lines = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < body.Length; i++)
        {
            var c = body[i];

            if (c == '"')
            {
                inQuotes = !inQuotes;
                current.Append(c);
            }
            else if ((c == '\n' || c == '\r') && !inQuotes)
            {
                // Collapse CRLF; skip the CR half so rows don't gain a phantom
                // trailing carriage return.
                if (c == '\r' && i + 1 < body.Length && body[i + 1] == '\n')
                {
                    continue;
                }

                if (current.Length > 0)
                {
                    lines.Add(current.ToString());
                    current.Clear();
                }
            }
            else
            {
                current.Append(c);
            }
        }

        if (current.Length > 0)
        {
            lines.Add(current.ToString());
        }

        return lines;
    }

    /// <summary>
    /// Splits one CSV row into fields, honouring RFC 4180 quoting: a quoted
    /// field may contain commas and doubled "" escapes. The old
    /// Split(',') + Trim('"') shredded any title like "Fix, quickly" into two
    /// columns and left stray quotes on the rest.
    /// </summary>
    private static List<string> SplitCsvRow(string line)
    {
        var fields = new List<string>();
        var current = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];

            if (c == '"')
            {
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    current.Append('"');
                    i++;
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                fields.Add(current.ToString());
                current.Clear();
            }
            else
            {
                current.Append(c);
            }
        }

        fields.Add(current.ToString());
        return fields;
    }

    private async Task<IActionResult> ProcessImport(
        Guid workspaceId,
        Guid projectId,
        List<ImportTaskItem> items,
        CancellationToken cancellationToken)
    {
        // The controller's only job is shape-agnostic parsing (CSV/JSON); the
        // writes go through ImportTasksCommand so authorization (member-only),
        // the project-to-workspace tenant check, cache invalidation and the
        // realtime board-wake all apply. Previously this method created
        // TaskItems through the repository directly from an unauthenticated
        // endpoint that never looked at workspaceId.
        var result = await sender.Send(
            new ImportTasksCommand(
                workspaceId,
                projectId,
                items.Select(i => new ImportTaskRow(i.Title, i.Description, i.Status, i.Priority)).ToList()),
            cancellationToken);

        return Ok(new ImportResult(result.Imported, result.Skipped, result.Errors));
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
        int TimeEntriesImported,
        IReadOnlyList<string> Errors);
}
