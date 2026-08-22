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

        foreach (var project in projects)
        {
            var tasks = await taskItemRepository.GetForProjectAsync(project.Id, null, cancellationToken);

            var matchedTasks = tasks
                .Where(t => t.Title.Contains(keyword, StringComparison.OrdinalIgnoreCase) ||
                           (t.Description != null && t.Description.Contains(keyword, StringComparison.OrdinalIgnoreCase)))
                .Take(10 - allTasks.Count) // Limit total to 10
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
