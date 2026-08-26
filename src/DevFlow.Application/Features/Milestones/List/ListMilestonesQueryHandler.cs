using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Milestones.List;

public sealed class ListMilestonesQueryHandler(
    IProjectRepository projectRepository,
    IMilestoneRepository milestoneRepository) : IRequestHandler<ListMilestonesQuery, IReadOnlyList<MilestoneResponse>>
{
    public async Task<IReadOnlyList<MilestoneResponse>> Handle(
        ListMilestonesQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var milestones = await milestoneRepository.GetForProjectAsync(query.ProjectId, cancellationToken);

        return milestones
            .Select(BuildMilestoneResponse)
            .ToList();
    }

    private static MilestoneResponse BuildMilestoneResponse(Milestone milestone)
    {
        return new MilestoneResponse(
            milestone.Id,
            milestone.ProjectId,
            milestone.Name,
            milestone.Description,
            milestone.TargetDateUtc,
            milestone.Status.ToString());
    }
}
