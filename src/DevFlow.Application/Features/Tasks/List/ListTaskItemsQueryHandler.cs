using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.List;

public sealed class ListTaskItemsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ITaskAttachmentRepository taskAttachmentRepository,
    IGitHubRepository gitHubRepository,
    ICacheService cacheService) : IRequestHandler<ListTaskItemsQuery, PagedResult<TaskItemResponse>>
{
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(30);

    public async Task<PagedResult<TaskItemResponse>> Handle(
        ListTaskItemsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        // Clamp page values
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var skip = (page - 1) * pageSize;
        var statusKey = query.Status?.ToString() ?? "all";
        var cacheKey = $"tasks:{query.ProjectId}:{statusKey}:{page}:{pageSize}";
        var tag = $"project:{query.ProjectId}";

        return await cacheService.GetOrSetAsync(
            cacheKey,
            ct => LoadTasksAsync(query, project.Key, skip, pageSize, cancellationToken),
            CacheTtl,
            [tag],
            cancellationToken);
    }

    private async Task<PagedResult<TaskItemResponse>> LoadTasksAsync(
        ListTaskItemsQuery query,
        string projectKey,
        int skip,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var totalCount = await taskItemRepository.GetCountForProjectAsync(
            query.ProjectId, query.Status, cancellationToken);

        var tasks = await taskItemRepository.GetForProjectPagedAsync(
            query.ProjectId, query.Status, skip, pageSize, cancellationToken);

        // Batch-fetch attachment metadata for the whole page in one grouped
        // query — avoids N+1 attachment queries per task card.
        var attachmentByTaskId = await taskAttachmentRepository.GetByTaskIdsAsync(
            tasks.Select(task => task.Id),
            cancellationToken);

        // One project-wide PR query for the whole page — the table holds few
        // rows per project, so grouping in memory beats a per-task lookup.
        var pullRequestsByTaskId = (await gitHubRepository.GetPullRequestsByProjectAsync(
                query.ProjectId, cancellationToken))
            .Where(pr => pr.LinkedTaskId.HasValue)
            .GroupBy(pr => pr.LinkedTaskId!.Value)
            .ToDictionary(group => group.Key, group => group.ToList());

        var items = tasks
            .Select(task => new TaskItemResponse(
                task.Id,
                task.ProjectId,
                TaskKey.Format(projectKey, task.Number),
                task.Number,
                task.Title,
                task.Description,
                task.DefinitionOfDone,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.AssigneeId,
                task.SprintId,
                task.EpicId,
                task.ParentTaskId,
                task.StoryPoints,
                task.DueDateUtc,
                task.CompletedAtUtc,
                task.Position,
                BuildAttachmentSummary(attachmentByTaskId.GetValueOrDefault(task.Id)),
                BuildPullRequestSummary(pullRequestsByTaskId.GetValueOrDefault(task.Id)),
                EnteredReviewAtUtc: task.EnteredReviewAtUtc))
            .ToList();

        return new PagedResult<TaskItemResponse>(items, totalCount, query.Page, pageSize);
    }

    /// <summary>
    /// Builds a card attachment summary: total count plus up to 3 image/*
    /// previews ({id, contentType}). Attachments are ordered newest-first
    /// (as returned by the repository).
    /// </summary>
    private static AttachmentSummary? BuildAttachmentSummary(IReadOnlyList<TaskAttachment>? attachments)
    {
        if (attachments is null || attachments.Count == 0)
        {
            return null;
        }

        var previews = attachments
            .Where(attachment => attachment.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            .Take(3)
            .Select(attachment => new AttachmentPreview(attachment.Id, attachment.ContentType))
            .ToList();

        return new AttachmentSummary(attachments.Count, previews);
    }

    /// <summary>
    /// Buckets a task's linked PRs by status for the card badge. Statuses are
    /// compared case-insensitively — legacy rows store lowercase "open" while
    /// the webhook and manual-add flows write "Open"/"Merged"/"Closed".
    /// </summary>
    private static PullRequestSummary? BuildPullRequestSummary(IReadOnlyList<PullRequest>? pullRequests)
    {
        if (pullRequests is null || pullRequests.Count == 0)
        {
            return null;
        }

        var open = pullRequests.Count(pr => "open".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));
        var merged = pullRequests.Count(pr => "merged".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));
        var closed = pullRequests.Count(pr => "closed".Equals(pr.Status, StringComparison.OrdinalIgnoreCase));

        return new PullRequestSummary(open, merged, closed);
    }
}
