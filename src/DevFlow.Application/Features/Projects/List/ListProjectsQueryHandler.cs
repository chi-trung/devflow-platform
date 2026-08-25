using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Projects.List;

public sealed class ListProjectsQueryHandler(
    IProjectRepository projectRepository) : IRequestHandler<ListProjectsQuery, PagedResult<ProjectResponse>>
{
    public async Task<PagedResult<ProjectResponse>> Handle(
        ListProjectsQuery query,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(query.WorkspaceId, cancellationToken);

        // Clamp page values
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var totalCount = projects.Count;
        var skip = (page - 1) * pageSize;

        var items = projects
            .Skip(skip)
            .Take(pageSize)
            .Select(project => new ProjectResponse(
                project.Id,
                project.Name,
                project.Key,
                project.Description,
                project.Status.ToString(),
                project.Emoji,
                project.CoverColor))
            .ToList();

        return new PagedResult<ProjectResponse>(items, totalCount, page, pageSize);
    }
}
