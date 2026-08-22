using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;
using System.Text;

namespace DevFlow.Application.Features.Export;

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

public sealed record ExportResult(string FileName, string ContentType, byte[] Data);
