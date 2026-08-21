using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Projects.List;

public sealed class ListProjectsQueryHandler(
    IProjectRepository projectRepository) : IRequestHandler<ListProjectsQuery, IReadOnlyList<ProjectResponse>>
{
    public async Task<IReadOnlyList<ProjectResponse>> Handle(
        ListProjectsQuery query,
        CancellationToken cancellationToken)
    {
        var projects = await projectRepository.GetForWorkspaceAsync(query.WorkspaceId, cancellationToken);

        return projects
            .Select(project => new ProjectResponse(
                project.Id,
                project.Name,
                project.Key,
                project.Description,
                project.Status.ToString()))
            .ToList();
    }
}
