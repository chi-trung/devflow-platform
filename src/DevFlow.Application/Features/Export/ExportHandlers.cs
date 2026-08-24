using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using System.Text;

namespace DevFlow.Application.Features.Export;

// ── Existing: export tasks only ──────────────────────────────────────────
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ExportProjectTasksQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    string Format) : IRequest<ExportResult>, IWorkspaceRequest;

public class ExportProjectTasksHandler(
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository)
    : IRequestHandler<ExportProjectTasksQuery, ExportResult>
{
    public async Task<ExportResult> Handle(ExportProjectTasksQuery request, CancellationToken ct)
    {
        var project = await projectRepository.GetByIdAsync(request.ProjectId, ct);
        var tasks = await taskItemRepository.GetForProjectAsync(request.ProjectId, null, ct);

        if (request.Format.ToLower() == "csv")
        {
            var csv = new StringBuilder();
            csv.AppendLine("Id,Title,Description,Status,Priority,AssigneeId,EstimatedMinutes,CreatedAt,CompletedAt");

            foreach (var task in tasks)
            {
                csv.AppendLine($"{task.Id},\"{Escape(task.Title)}\",\"{Escape(task.Description ?? "")}\",{task.Status},{task.Priority},{task.AssigneeId},{task.EstimateMinutes},{task.CreatedAtUtc:O},{task.CompletedAtUtc:O}");
            }

            return new ExportResult(
                $"{project?.Name ?? "project"}-tasks.csv",
                "text/csv",
                Encoding.UTF8.GetBytes(csv.ToString()));
        }

        var json = System.Text.Json.JsonSerializer.Serialize(tasks.Select(t => new
        {
            t.Id,
            t.Title,
            t.Description,
            Status = t.Status.ToString(),
            Priority = t.Priority.ToString(),
            t.AssigneeId,
            t.EstimateMinutes,
            t.CreatedAtUtc,
            t.CompletedAtUtc
        }), new System.Text.Json.JsonSerializerOptions { WriteIndented = true });

        return new ExportResult(
            $"{project?.Name ?? "project"}-tasks.json",
            "application/json",
            Encoding.UTF8.GetBytes(json));
    }

    private static string Escape(string value) => value.Replace("\"", "\"\"");
}

// ── New: full project backup (JSON + Excel) ──────────────────────────────

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ExportProjectBackupQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    string Format) : IRequest<ExportResult>, IWorkspaceRequest;

public class ExportProjectBackupHandler(
    ITaskItemRepository taskItemRepository,
    IEpicRepository epicRepository,
    ISprintRepository sprintRepository,
    ICommentRepository commentRepository,
    IProjectRepository projectRepository)
    : IRequestHandler<ExportProjectBackupQuery, ExportResult>
{
    public async Task<ExportResult> Handle(ExportProjectBackupQuery request, CancellationToken ct)
    {
        var project = await projectRepository.GetByIdAsync(request.ProjectId, ct);
        var tasks = await taskItemRepository.GetForProjectAsync(request.ProjectId, null, ct);
        var epics = await epicRepository.GetForProjectAsync(request.ProjectId, ct);
        var sprints = await sprintRepository.GetForProjectAsync(request.ProjectId, ct);

        var allComments = new List<CommentDto>();
        foreach (var task in tasks)
        {
            var comments = await commentRepository.GetForTaskAsync(task.Id, ct);
            allComments.AddRange(comments.Select(c => new CommentDto
            {
                Id = c.Id,
                TaskItemId = c.TaskItemId,
                AuthorId = c.AuthorId,
                Content = c.Content,
                CreatedAtUtc = c.CreatedAtUtc
            }));
        }

        var backup = new ProjectBackupData
        {
            ProjectId = request.ProjectId,
            ProjectName = project?.Name ?? "project",
            ExportedAtUtc = DateTimeOffset.UtcNow,
            Tasks = tasks.Select(t => new TaskBackupDto
            {
                Id = t.Id,
                Title = t.Title,
                Description = t.Description,
                Status = t.Status.ToString(),
                Priority = t.Priority.ToString(),
                AssigneeId = t.AssigneeId,
                SprintId = t.SprintId,
                EpicId = t.EpicId,
                ParentTaskId = t.ParentTaskId,
                StoryPoints = t.StoryPoints,
                DueDateUtc = t.DueDateUtc,
                EstimateMinutes = t.EstimateMinutes,
                Position = t.Position,
                CreatedAtUtc = t.CreatedAtUtc
            }).ToList(),
            Epics = epics.Select(e => new EpicBackupDto
            {
                Id = e.Id,
                Name = e.Name,
                Description = e.Description,
                StartDateUtc = e.StartDateUtc,
                EndDateUtc = e.EndDateUtc,
                CreatedAtUtc = e.CreatedAtUtc
            }).ToList(),
            Sprints = sprints.Select(s => new SprintBackupDto
            {
                Id = s.Id,
                Name = s.Name,
                Goal = s.Goal,
                Status = s.Status.ToString(),
                StartDateUtc = s.StartDateUtc,
                EndDateUtc = s.EndDateUtc,
                CompletedAtUtc = s.CompletedAtUtc,
                CreatedAtUtc = s.CreatedAtUtc
            }).ToList(),
            Comments = allComments
        };

        var projectName = project?.Name ?? "project";

        if (request.Format.ToLower() == "excel" || request.Format.ToLower() == "xlsx")
        {
            return GenerateExcel(backup, projectName);
        }

        var jsonOptions = new System.Text.Json.JsonSerializerOptions { WriteIndented = true };
        var json = System.Text.Json.JsonSerializer.Serialize(backup, jsonOptions);

        return new ExportResult(
            $"{projectName}-backup.json",
            "application/json",
            Encoding.UTF8.GetBytes(json));
    }

    private static ExportResult GenerateExcel(ProjectBackupData backup, string projectName)
    {
        using var workbook = new ClosedXML.Excel.XLWorkbook();

        var tasksSheet = workbook.Worksheets.Add("Tasks");
        tasksSheet.Cell(1, 1).Value = "Id";
        tasksSheet.Cell(1, 2).Value = "Title";
        tasksSheet.Cell(1, 3).Value = "Description";
        tasksSheet.Cell(1, 4).Value = "Status";
        tasksSheet.Cell(1, 5).Value = "Priority";
        tasksSheet.Cell(1, 6).Value = "AssigneeId";
        tasksSheet.Cell(1, 7).Value = "SprintId";
        tasksSheet.Cell(1, 8).Value = "EpicId";
        tasksSheet.Cell(1, 9).Value = "ParentTaskId";
        tasksSheet.Cell(1, 10).Value = "StoryPoints";
        tasksSheet.Cell(1, 11).Value = "DueDateUtc";
        tasksSheet.Cell(1, 12).Value = "EstimateMinutes";
        tasksSheet.Cell(1, 13).Value = "Position";
        tasksSheet.Cell(1, 14).Value = "CreatedAtUtc";

        for (int i = 0; i < backup.Tasks.Count; i++)
        {
            var t = backup.Tasks[i];
            tasksSheet.Cell(i + 2, 1).Value = t.Id.ToString();
            tasksSheet.Cell(i + 2, 2).Value = t.Title;
            tasksSheet.Cell(i + 2, 3).Value = t.Description ?? "";
            tasksSheet.Cell(i + 2, 4).Value = t.Status;
            tasksSheet.Cell(i + 2, 5).Value = t.Priority;
            tasksSheet.Cell(i + 2, 6).Value = t.AssigneeId?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 7).Value = t.SprintId?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 8).Value = t.EpicId?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 9).Value = t.ParentTaskId?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 10).Value = t.StoryPoints?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 11).Value = t.DueDateUtc?.ToString("O") ?? "";
            tasksSheet.Cell(i + 2, 12).Value = t.EstimateMinutes?.ToString() ?? "";
            tasksSheet.Cell(i + 2, 13).Value = t.Position;
            tasksSheet.Cell(i + 2, 14).Value = t.CreatedAtUtc.ToString("O");
        }
        tasksSheet.Columns().AdjustToContents();

        var epicsSheet = workbook.Worksheets.Add("Epics");
        epicsSheet.Cell(1, 1).Value = "Id";
        epicsSheet.Cell(1, 2).Value = "Name";
        epicsSheet.Cell(1, 3).Value = "Description";
        epicsSheet.Cell(1, 4).Value = "StartDateUtc";
        epicsSheet.Cell(1, 5).Value = "EndDateUtc";
        epicsSheet.Cell(1, 6).Value = "CreatedAtUtc";

        for (int i = 0; i < backup.Epics.Count; i++)
        {
            var e = backup.Epics[i];
            epicsSheet.Cell(i + 2, 1).Value = e.Id.ToString();
            epicsSheet.Cell(i + 2, 2).Value = e.Name;
            epicsSheet.Cell(i + 2, 3).Value = e.Description ?? "";
            epicsSheet.Cell(i + 2, 4).Value = e.StartDateUtc?.ToString("O") ?? "";
            epicsSheet.Cell(i + 2, 5).Value = e.EndDateUtc?.ToString("O") ?? "";
            epicsSheet.Cell(i + 2, 6).Value = e.CreatedAtUtc.ToString("O");
        }
        epicsSheet.Columns().AdjustToContents();

        var sprintsSheet = workbook.Worksheets.Add("Sprints");
        sprintsSheet.Cell(1, 1).Value = "Id";
        sprintsSheet.Cell(1, 2).Value = "Name";
        sprintsSheet.Cell(1, 3).Value = "Goal";
        sprintsSheet.Cell(1, 4).Value = "Status";
        sprintsSheet.Cell(1, 5).Value = "StartDateUtc";
        sprintsSheet.Cell(1, 6).Value = "EndDateUtc";
        sprintsSheet.Cell(1, 7).Value = "CompletedAtUtc";
        sprintsSheet.Cell(1, 8).Value = "CreatedAtUtc";

        for (int i = 0; i < backup.Sprints.Count; i++)
        {
            var s = backup.Sprints[i];
            sprintsSheet.Cell(i + 2, 1).Value = s.Id.ToString();
            sprintsSheet.Cell(i + 2, 2).Value = s.Name;
            sprintsSheet.Cell(i + 2, 3).Value = s.Goal ?? "";
            sprintsSheet.Cell(i + 2, 4).Value = s.Status;
            sprintsSheet.Cell(i + 2, 5).Value = s.StartDateUtc?.ToString("O") ?? "";
            sprintsSheet.Cell(i + 2, 6).Value = s.EndDateUtc?.ToString("O") ?? "";
            sprintsSheet.Cell(i + 2, 7).Value = s.CompletedAtUtc?.ToString("O") ?? "";
            sprintsSheet.Cell(i + 2, 8).Value = s.CreatedAtUtc.ToString("O");
        }
        sprintsSheet.Columns().AdjustToContents();

        var commentsSheet = workbook.Worksheets.Add("Comments");
        commentsSheet.Cell(1, 1).Value = "Id";
        commentsSheet.Cell(1, 2).Value = "TaskItemId";
        commentsSheet.Cell(1, 3).Value = "AuthorId";
        commentsSheet.Cell(1, 4).Value = "Content";
        commentsSheet.Cell(1, 5).Value = "CreatedAtUtc";

        for (int i = 0; i < backup.Comments.Count; i++)
        {
            var c = backup.Comments[i];
            commentsSheet.Cell(i + 2, 1).Value = c.Id.ToString();
            commentsSheet.Cell(i + 2, 2).Value = c.TaskItemId.ToString();
            commentsSheet.Cell(i + 2, 3).Value = c.AuthorId.ToString();
            commentsSheet.Cell(i + 2, 4).Value = c.Content;
            commentsSheet.Cell(i + 2, 5).Value = c.CreatedAtUtc.ToString("O");
        }
        commentsSheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        stream.Position = 0;

        return new ExportResult(
            $"{projectName}-backup.xlsx",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            stream.ToArray());
    }
}

public sealed record ExportResult(string FileName, string ContentType, byte[] Data);

// ── DTOs for backup serialization ────────────────────────────────────────

public sealed class ProjectBackupData
{
    public Guid ProjectId { get; set; }
    public string ProjectName { get; set; } = string.Empty;
    public DateTimeOffset ExportedAtUtc { get; set; }
    public List<TaskBackupDto> Tasks { get; set; } = new();
    public List<EpicBackupDto> Epics { get; set; } = new();
    public List<SprintBackupDto> Sprints { get; set; } = new();
    public List<CommentDto> Comments { get; set; } = new();
}

public sealed class TaskBackupDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Status { get; set; } = "Backlog";
    public string Priority { get; set; } = "Medium";
    public Guid? AssigneeId { get; set; }
    public Guid? SprintId { get; set; }
    public Guid? EpicId { get; set; }
    public Guid? ParentTaskId { get; set; }
    public int? StoryPoints { get; set; }
    public DateTimeOffset? DueDateUtc { get; set; }
    public int? EstimateMinutes { get; set; }
    public int Position { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class EpicBackupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTimeOffset? StartDateUtc { get; set; }
    public DateTimeOffset? EndDateUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class SprintBackupDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Goal { get; set; }
    public string Status { get; set; } = "Planned";
    public DateTimeOffset? StartDateUtc { get; set; }
    public DateTimeOffset? EndDateUtc { get; set; }
    public DateTimeOffset? CompletedAtUtc { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
}

public sealed class CommentDto
{
    public Guid Id { get; set; }
    public Guid TaskItemId { get; set; }
    public Guid AuthorId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }
}
