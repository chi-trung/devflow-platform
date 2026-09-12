using System.Security.Cryptography;
using System.Text;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Common;
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
    IReadOnlyList<string> CommitMessages,
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
        IRealtimeNotifier realtimeNotifier,
        ICacheService cacheService,
        CancellationToken cancellationToken)
    {
        if (payload.ProjectId == null || string.IsNullOrWhiteSpace(payload.RepositoryUrl))
            return;

        // Same canonical key the controller looked up and the integration was
        // stored under — an exact-equality miss here would silently drop the
        // whole event after the signature check already passed.
        var canonicalRepositoryUrl = GitHubUrl.CanonicalizeRepository(payload.RepositoryUrl) ?? payload.RepositoryUrl;
        var integration = await gitHubRepository.GetByRepositoryUrlAsync(canonicalRepositoryUrl, cancellationToken);
        if (integration == null)
            return;

        var project = await projectRepository.GetByIdAsync(payload.ProjectId.Value, cancellationToken);
        if (project == null)
            return;

        var projectId = payload.ProjectId.Value;
        var projectKey = project.Key;
        var workspaceId = project.WorkspaceId;
        var actorName = payload.SenderLogin ?? payload.SenderName ?? "GitHub";

        var taskKeys = TaskKeyParser.ParseKeys(
            string.Join(" ",
                payload.PrTitle ?? "",
                payload.PrBody ?? "",
                payload.IssueTitle ?? "",
                payload.IssueBody ?? "",
                string.Join(" ", payload.CommitMessages)),
            projectKey);

        var projectTasks = await taskItemRepository.GetForProjectAsync(projectId, null, cancellationToken);

        var tasks = new List<TaskItem>();
        foreach (var key in taskKeys)
        {
            // Preferred: the key's trailing number matches a stored task number
            // (works even when the title no longer starts with the key).
            var numberMatch = System.Text.RegularExpressions.Regex.Match(key, @"-(\d+)$");
            TaskItem? matched = null;
            if (numberMatch.Success && int.TryParse(numberMatch.Groups[1].Value, out var number))
            {
                matched = projectTasks.FirstOrDefault(t => t.Number == number);
            }

            // Fallbacks (pre-key-storage tasks and titles still embedding keys):
            // title starts with the key, then key appears anywhere in the title.
            matched ??= projectTasks.FirstOrDefault(t =>
                t.Title.StartsWith(key, StringComparison.OrdinalIgnoreCase));
            matched ??= projectTasks.FirstOrDefault(t =>
                t.Title.Contains(key, StringComparison.OrdinalIgnoreCase));

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

        // Upsert the PullRequest row so the task's PR list reflects reality.
        // Match by Url keeps webhook redeliveries (and the synchronize/edited
        // actions GitHub fires after "opened") from creating duplicates.
        if (payload.Event == "pull_request" && !string.IsNullOrWhiteSpace(payload.PrUrl))
        {
            await UpsertPullRequestAsync(payload, gitHubRepository, projectId, tasks[0].Id, actorName, cancellationToken);
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

            // Status changes must land on a TRACKED instance — the project-wide
            // match query is AsNoTracking, so mutating its results would never
            // reach the database. GetByIdAsync is tracked by default.
            if (payload.Event == "pull_request" && payload.Action == "opened" && task.Status != TaskItemStatus.Review)
            {
                var tracked = await taskItemRepository.GetByIdAsync(task.Id, cancellationToken);
                tracked?.ChangeStatus(TaskItemStatus.Review);
            }
            else if (payload.Event == "pull_request" && payload.PrMerged && task.Status != TaskItemStatus.Done)
            {
                var tracked = await taskItemRepository.GetByIdAsync(task.Id, cancellationToken);
                tracked?.ChangeStatus(TaskItemStatus.Done);
            }
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // The webhook path bypasses MediatR's RealtimeBehavior — push the
        // board-refresh event here so open boards pick up the change live.
        await realtimeNotifier.NotifyProjectAsync(projectId, "GitHubWebhook", cancellationToken);

        // …and it bypasses CacheInvalidationBehavior too — drop the cached
        // task pages so PR badges and auto-status changes show immediately
        // instead of waiting out the 30s TTL.
        await cacheService.RemoveByTagAsync($"project:{projectId}", cancellationToken);
    }

    private static async Task UpsertPullRequestAsync(
        GitHubWebhookPayload payload,
        IGitHubRepository gitHubRepository,
        Guid projectId,
        Guid linkedTaskId,
        string actorName,
        CancellationToken cancellationToken)
    {
        // Match on the canonical PR URL, not the raw string: the manual
        // add-PR form stores whatever the user pasted (trailing slash, www.,
        // different casing), and an exact-equality miss here would re-create
        // the row on every redelivery instead of updating it in place.
        var existing = (await gitHubRepository.GetPullRequestsByProjectAsync(projectId, cancellationToken))
            .FirstOrDefault(pr => GitHubUrl.SamePullRequest(pr.Url, payload.PrUrl));

        // Statuses are capitalized to match rows from the manual add-PR flow
        // and the frontend's status style map.
        switch (payload.Action)
        {
            case "opened":
            case "reopened":
                if (existing != null)
                {
                    existing.UpdateStatus("Open");
                }
                else
                {
                    var created = PullRequest.Create(
                        projectId,
                        payload.PrTitle ?? "Pull request",
                        payload.PrUrl!,
                        "Open",
                        actorName);
                    created.LinkToTask(linkedTaskId);
                    await gitHubRepository.AddPullRequestAsync(created, cancellationToken);
                }
                break;

            case "closed":
                var status = payload.PrMerged ? "Merged" : "Closed";
                if (existing != null)
                {
                    existing.UpdateStatus(status);
                }
                else
                {
                    // Late-binding: the PR was never seen "opened" (created
                    // outside DevFlow's knowledge) — record it closed.
                    var created = PullRequest.Create(
                        projectId,
                        payload.PrTitle ?? "Pull request",
                        payload.PrUrl!,
                        status,
                        actorName);
                    created.LinkToTask(linkedTaskId);
                    await gitHubRepository.AddPullRequestAsync(created, cancellationToken);
                }
                break;

            // synchronize / edited / assigned / …: no row changes.
        }
    }
}
