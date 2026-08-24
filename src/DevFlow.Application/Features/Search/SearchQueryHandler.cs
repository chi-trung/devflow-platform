using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed class SearchQueryHandler(
    ISearchRepository searchRepository,
    IWorkspaceRepository workspaceRepository) : IRequestHandler<SearchQuery, SearchResult>
{
    public async Task<SearchResult> Handle(SearchQuery query, CancellationToken cancellationToken)
    {
        var keyword = query.Keyword.Trim();

        if (string.IsNullOrWhiteSpace(keyword))
        {
            return new SearchResult([], [], [], [], [], [], new SearchPagination(
                query.Page, query.PageSize, 0, 0, 0, 0, 0, 0));
        }

        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 50);
        var skip = (page - 1) * pageSize;

        var filters = new TaskItemSearchFilters(
            ParseStatus(query.Status),
            ParsePriority(query.Priority),
            query.AssigneeId,
            query.LabelId,
            query.DueBefore,
            query.DueAfter);

        // One query per entity group (≤5), all issued against the workspace's
        // project IDs so results never leak across workspaces.
        var tasksTask = searchRepository.SearchTasksAsync(query.WorkspaceId, keyword, filters, skip, pageSize, cancellationToken);
        var projectsTask = searchRepository.SearchProjectsAsync(query.WorkspaceId, keyword, pageSize, cancellationToken);
        var epicsTask = searchRepository.SearchEpicsAsync(query.WorkspaceId, keyword, pageSize, cancellationToken);
        var labelsTask = searchRepository.SearchLabelsAsync(query.WorkspaceId, keyword, pageSize, cancellationToken);

        await Task.WhenAll(tasksTask, projectsTask, epicsTask, labelsTask);

        var tasks = tasksTask.Result;
        var projects = projectsTask.Result;
        var epics = epicsTask.Result;
        var labels = labelsTask.Result;

        // Users (workspace members) + comments (content keyword) stay on the
        // workspace-level repositories since they aren't project-scoped.
        var membersTask = workspaceRepository.GetMembersAsync(query.WorkspaceId, cancellationToken);
        var commentsTask = searchRepository.SearchCommentsAsync(query.WorkspaceId, keyword, skip, pageSize, cancellationToken);

        await Task.WhenAll(membersTask, commentsTask);

        var members = membersTask.Result;
        var comments = commentsTask.Result;

        var taskResults = tasks.Items.Select(t => new TaskItemResult(t.Id, t.Title, t.Status, t.ProjectKey)).ToList();
        var projectResults = projects.Select(p => new ProjectResult(p.Id, p.Name, p.Key, p.Status)).ToList();
        var epicResults = epics.Select(e => new EpicResult(e.Id, e.Name, e.ProjectKey)).ToList();
        var labelResults = labels.Select(l => new LabelResult(l.Id, l.Name, l.Color, l.ProjectKey)).ToList();
        var userResults = members
            .Where(m => m.DisplayName.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                        m.Username.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            .Take(pageSize)
            .Select(m => new UserResult(m.UserId, m.DisplayName, m.Username))
            .ToList();
        var commentResults = comments.Items.Select(c => new CommentResult(c.Id, c.Content, c.TaskItemId, c.TaskTitle, c.ProjectKey)).ToList();

        var totalUsers = members.Count(m =>
            m.DisplayName.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
            m.Username.Contains(keyword, StringComparison.OrdinalIgnoreCase));

        var pagination = new SearchPagination(
            page,
            pageSize,
            tasks.Total,
            projectResults.Count,
            epicResults.Count,
            labelResults.Count,
            totalUsers,
            comments.Total);

        return new SearchResult(taskResults, projectResults, epicResults, labelResults, userResults, commentResults, pagination);
    }

    private static TaskItemStatus? ParseStatus(string? status)
        => Enum.TryParse<TaskItemStatus>(status, true, out var s) ? s : null;

    private static TaskItemPriority? ParsePriority(string? priority)
        => Enum.TryParse<TaskItemPriority>(priority, true, out var p) ? p : null;
}
