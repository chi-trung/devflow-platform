using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.List;

public sealed class ListEpicsQueryHandler(
    IProjectRepository projectRepository,
    IEpicRepository epicRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<ListEpicsQuery, IReadOnlyList<EpicResponse>>
{
    public async Task<IReadOnlyList<EpicResponse>> Handle(
        ListEpicsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var epics = await epicRepository.GetForProjectAsync(query.ProjectId, cancellationToken);
        var tasks = await taskItemRepository.GetForProjectAsync(query.ProjectId, status: null, cancellationToken);

        return epics
            .Select(epic => BuildEpicResponse(epic, tasks))
            .ToList();
    }

    private static EpicResponse BuildEpicResponse(Epic epic, IReadOnlyList<TaskItem> tasks)
    {
        var epicTasks = tasks.Where(task => task.EpicId == epic.Id).ToList();
        var completedTasks = epicTasks.Count(task => task.Status == TaskItemStatus.Done);
        var totalStoryPoints = epicTasks.Sum(task => task.StoryPoints ?? 0);
        var completedStoryPoints = epicTasks
            .Where(task => task.Status == TaskItemStatus.Done)
            .Sum(task => task.StoryPoints ?? 0);

        var completionPercent = epicTasks.Count == 0
            ? 0
            : Math.Round(completedTasks * 100.0 / epicTasks.Count, 1);

        return new EpicResponse(
            epic.Id,
            epic.ProjectId,
            epic.Name,
            epic.Description,
            epic.StartDateUtc,
            epic.EndDateUtc,
            epicTasks.Count,
            completedTasks,
            completionPercent,
            totalStoryPoints,
            completedStoryPoints);
    }
}
