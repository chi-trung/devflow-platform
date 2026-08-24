using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed class SearchQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IEpicRepository epicRepository,
    ILabelRepository labelRepository,
    ICommentRepository commentRepository,
    IWorkspaceRepository workspaceRepository) : IRequestHandler<SearchQuery, SearchResult>
{
    public async Task<SearchResult> Handle(SearchQuery query, CancellationToken cancellationToken)
    {
        var keyword = query.Keyword.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(keyword))
        {
            return new SearchResult([], [], [], [], [], []);
        }

        // Search projects by name or key
        var projects = await projectRepository.GetForWorkspaceAsync(query.WorkspaceId, cancellationToken);

        var matchedProjects = projects
            .Where(p => p.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                       p.Key.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            .Take(10)
            .Select(p => new ProjectResult(
                p.Id,
                p.Name,
                p.Key,
                p.Status.ToString()))
            .ToList();

        // Search tasks across all projects in workspace
        var allTasks = new List<TaskItemResult>();

        // Parse optional filter values
        var filterStatus = string.IsNullOrEmpty(query.Status) ? null :
            Enum.TryParse<Domain.Enums.TaskItemStatus>(query.Status, true, out var s) ? s : (Domain.Enums.TaskItemStatus?)null;
        var filterPriority = string.IsNullOrEmpty(query.Priority) ? null :
            Enum.TryParse<Domain.Enums.TaskItemPriority>(query.Priority, true, out var p) ? p : (Domain.Enums.TaskItemPriority?)null;

        foreach (var project in projects)
        {
            var tasks = await taskItemRepository.GetForProjectAsync(project.Id, null, cancellationToken);

            var matchedTasks = tasks
                .Where(t => string.IsNullOrWhiteSpace(keyword) ||
                           t.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                           (t.Description != null && t.Description.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
                .Where(t => !filterStatus.HasValue || t.Status == filterStatus.Value)
                .Where(t => !filterPriority.HasValue || t.Priority == filterPriority.Value)
                .Where(t => !query.AssigneeId.HasValue || t.AssigneeId == query.AssigneeId.Value)
                .Where(t => !query.DueBefore.HasValue || (t.DueDateUtc.HasValue && t.DueDateUtc.Value <= query.DueBefore.Value))
                .Where(t => !query.DueAfter.HasValue || (t.DueDateUtc.HasValue && t.DueDateUtc.Value >= query.DueAfter.Value))
                .Take(10 - allTasks.Count)
                .Select(t => new TaskItemResult(
                    t.Id,
                    t.Title,
                    t.Status.ToString(),
                    project.Key));

            allTasks.AddRange(matchedTasks);

            if (allTasks.Count >= 10)
            {
                break;
            }
        }

        // Search epics
        var allEpics = new List<EpicResult>();
        foreach (var project in projects)
        {
            var epics = await epicRepository.GetForProjectAsync(project.Id, cancellationToken);
            var matchedEpics = epics
                .Where(e => e.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                .Take(5 - allEpics.Count)
                .Select(e => new EpicResult(e.Id, e.Name, project.Key));
            allEpics.AddRange(matchedEpics);
            if (allEpics.Count >= 5) break;
        }

        // Search labels
        var allLabels = new List<LabelResult>();
        foreach (var project in projects)
        {
            var labels = await labelRepository.GetForProjectAsync(project.Id, cancellationToken);
            var matchedLabels = labels
                .Where(l => l.Name.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                .Take(5 - allLabels.Count)
                .Select(l => new LabelResult(l.Id, l.Name, l.Color, project.Key));
            allLabels.AddRange(matchedLabels);
            if (allLabels.Count >= 5) break;
        }

        // Search users (workspace members)
        var members = await workspaceRepository.GetMembersAsync(query.WorkspaceId, cancellationToken);
        var matchedUsers = members
            .Where(m => m.DisplayName.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                       m.Username.Contains(keyword, StringComparison.OrdinalIgnoreCase))
            .Take(5)
            .Select(m => new UserResult(m.UserId, m.DisplayName, m.Username))
            .ToList();

        // Search comments (across tasks we already fetched)
        var allComments = new List<CommentResult>();
        foreach (var project in projects)
        {
            var tasks = await taskItemRepository.GetForProjectAsync(project.Id, null, cancellationToken);
            foreach (var task in tasks.Take(50)) // Limit to avoid N+1
            {
                var comments = await commentRepository.GetForTaskAsync(task.Id, cancellationToken);
                var matchedComments = comments
                    .Where(c => c.Content.Contains(keyword, StringComparison.OrdinalIgnoreCase))
                    .Take(Math.Max(0, 5 - allComments.Count))
                    .Select(c => new CommentResult(c.Id, c.Content, c.TaskItemId, task.Title, project.Key));
                allComments.AddRange(matchedComments);
                if (allComments.Count >= 5) break;
            }
            if (allComments.Count >= 5) break;
        }

        return new SearchResult(allTasks, matchedProjects, allEpics, allLabels, matchedUsers, allComments);
    }
}
