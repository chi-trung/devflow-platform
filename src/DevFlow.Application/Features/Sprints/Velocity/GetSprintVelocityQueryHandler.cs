using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Velocity;

public sealed class GetSprintVelocityQueryHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<GetSprintVelocityQuery, SprintVelocityResponse>
{
    public async Task<SprintVelocityResponse> Handle(
        GetSprintVelocityQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var sprint = await sprintRepository.GetByIdAsync(query.SprintId, cancellationToken);

        if (sprint is null || sprint.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(Sprint), query.SprintId);
        }

        var tasks = await taskItemRepository.GetForProjectAsync(query.ProjectId, status: null, cancellationToken);
        var sprintTasks = tasks.Where(task => task.SprintId == query.SprintId).ToList();

        var completedTasks = sprintTasks.Count(task => task.Status == TaskItemStatus.Done);
        var totalStoryPoints = sprintTasks.Sum(task => task.StoryPoints ?? 0);
        var completedStoryPoints = sprintTasks
            .Where(task => task.Status == TaskItemStatus.Done)
            .Sum(task => task.StoryPoints ?? 0);

        var completionPercent = sprintTasks.Count == 0
            ? 0
            : Math.Round(completedTasks * 100.0 / sprintTasks.Count, 1);

        return new SprintVelocityResponse(
            query.SprintId,
            sprintTasks.Count,
            completedTasks,
            totalStoryPoints,
            completedStoryPoints,
            completionPercent);
    }
}
