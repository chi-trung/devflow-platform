using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed class SearchQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<SearchQuery, SearchResult>
{
    public async Task<SearchResult> Handle(SearchQuery query, CancellationToken cancellationToken)
    {
        var keyword = query.Keyword.Trim().ToLowerInvariant();

        if (string.IsNullOrWhiteSpace(keyword))
        {
            return new SearchResult([], []);
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

        return new SearchResult(allTasks, matchedProjects);
    }
}
