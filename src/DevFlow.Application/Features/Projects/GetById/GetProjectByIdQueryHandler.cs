using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Projects.List;
using MediatR;

namespace DevFlow.Application.Features.Projects.GetById;

public sealed class GetProjectByIdQueryHandler(
    IProjectRepository projectRepository) : IRequestHandler<GetProjectByIdQuery, ProjectResponse>
{
    public async Task<ProjectResponse> Handle(
        GetProjectByIdQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Domain.Entities.Project), query.ProjectId);
        }

        return new ProjectResponse(
            project.Id,
            project.Name,
            project.Key,
            project.Description,
            project.Status.ToString());
    }
}
