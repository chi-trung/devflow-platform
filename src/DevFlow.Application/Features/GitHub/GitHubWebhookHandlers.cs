using System.Security.Cryptography;
using System.Text;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.GitHub;

public record GitHubWebhookPayload(
    string Event,
    string? Action,
    string? RepositoryUrl,
    string? SenderLogin,
    string? SenderName,
    string? PrTitle,
    string? PrBody,
    string? PrUrl,
    string? PrState,
    bool PrMerged,
    string? IssueTitle,
    string? IssueBody,
    string? IssueUrl,
    string? IssueState,
    string? CommitMessage,
    string? Ref,
    Guid? ProjectId);

public static class GitHubWebhookHandler
{
    public static async Task ProcessAsync(
        GitHubWebhookPayload payload,
        IGitHubRepository gitHubRepository,
        IActivityLogRepository activityLogRepository,
        ITaskItemRepository taskItemRepository,
        IProjectRepository projectRepository,
        IUnitOfWork unitOfWork,
        CancellationToken cancellationToken)
    {
        if (payload.ProjectId == null || string.IsNullOrWhiteSpace(payload.RepositoryUrl))
            return;

        var integration = await gitHubRepository.GetByRepositoryUrlAsync(payload.RepositoryUrl, cancellationToken);
        if (integration == null)
            return;

        var project = await projectRepository.GetByIdAsync(payload.ProjectId.Value, cancellationToken);
        if (project == null)
            return;

        var projectKey = project.Key;
        var workspaceId = project.WorkspaceId;
        var actorName = payload.SenderLogin ?? payload.SenderName ?? "GitHub";

        var taskKeys = TaskKeyParser.ParseKeys(
            string.Join(" ", payload.PrTitle ?? "", payload.PrBody ?? "", payload.IssueTitle ?? "", payload.IssueBody ?? "", payload.CommitMessage ?? ""),
            projectKey);

        var projectTasks = await taskItemRepository.GetForProjectAsync(payload.ProjectId.Value, null, cancellationToken);

        var tasks = new List<TaskItem>();
        foreach (var key in taskKeys)
        {
            // Preferred: title starts with the key (e.g. "DF-104: Fix CORS headers")
            var matched = projectTasks.FirstOrDefault(t =>
                t.Title.StartsWith(key, StringComparison.OrdinalIgnoreCase)) ??
                // Fallback: key appears anywhere in the title
                projectTasks.FirstOrDefault(t => t.Title.Contains(key, StringComparison.OrdinalIgnoreCase));

            if (matched != null && !tasks.Contains(matched))
                tasks.Add(matched);
        }

        if (tasks.Count == 0)
            return;

        string action;
        switch (payload.Event)
        {
            case "push":
                action = $"GitHub: push {payload.Ref} on {payload.RepositoryUrl}";
                break;
            case "pull_request":
                action = $"GitHub: PR {payload.PrState} {payload.PrTitle}";
                break;
            case "issues":
                action = $"GitHub: issue {payload.IssueState} {payload.IssueTitle}";
                break;
            default:
                action = $"GitHub: {payload.Event}";
                break;
        }

        foreach (var task in tasks)
        {
            await activityLogRepository.AddAsync(ActivityLog.Create(
                workspaceId,
                task.ProjectId,
                task.Id,
                Guid.Empty,
                action,
                task.Title), cancellationToken);

            if (payload.Event == "pull_request" && payload.Action == "opened" && task.Status != TaskItemStatus.Review)
            {
                task.ChangeStatus(TaskItemStatus.Review);
            }
            else if (payload.Event == "pull_request" && payload.PrMerged && task.Status != TaskItemStatus.Done)
            {
                task.ChangeStatus(TaskItemStatus.Done);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
