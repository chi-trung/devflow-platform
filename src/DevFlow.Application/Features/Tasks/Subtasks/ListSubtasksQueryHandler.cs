using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

public sealed class ListSubtasksQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<ListSubtasksQuery, IReadOnlyList<TaskItemResponse>>
{
    public async Task<IReadOnlyList<TaskItemResponse>> Handle(
        ListSubtasksQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var parent = await taskItemRepository.GetByIdAsync(query.ParentTaskId, cancellationToken);

        if (parent is null || parent.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.ParentTaskId);
        }

        var subtasks = await taskItemRepository.GetSubtasksAsync(query.ParentTaskId, cancellationToken);

        return subtasks
            .OrderBy(task => task.Position)
            .ThenByDescending(task => task.CreatedAtUtc)
            .Select(task => new TaskItemResponse(
                task.Id,
                task.ProjectId,
                task.Title,
                task.Description,
                task.DefinitionOfDone,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.AssigneeId,
                task.SprintId,
                task.EpicId,
                task.ParentTaskId,
                task.StoryPoints,
                task.DueDateUtc,
                task.CompletedAtUtc,
                task.Position))
            .ToList();
    }
}
