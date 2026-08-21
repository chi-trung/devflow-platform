using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.List;

public sealed class ListSprintsQueryHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository) : IRequestHandler<ListSprintsQuery, IReadOnlyList<SprintResponse>>
{
    public async Task<IReadOnlyList<SprintResponse>> Handle(
        ListSprintsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var sprints = await sprintRepository.GetForProjectAsync(query.ProjectId, cancellationToken);

        return sprints
            .Select(sprint => new SprintResponse(
                sprint.Id,
                sprint.ProjectId,
                sprint.Name,
                sprint.Goal,
                sprint.Status.ToString(),
                sprint.StartDateUtc,
                sprint.EndDateUtc,
                sprint.CompletedAtUtc))
            .ToList();
    }
}
