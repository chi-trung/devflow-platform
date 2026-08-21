using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.List;

public sealed class ListTaskItemsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<ListTaskItemsQuery, IReadOnlyList<TaskItemResponse>>
{
    public async Task<IReadOnlyList<TaskItemResponse>> Handle(
        ListTaskItemsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var tasks = await taskItemRepository.GetForProjectAsync(query.ProjectId, query.Status, cancellationToken);

        return tasks
            .Select(task => new TaskItemResponse(
                task.Id,
                task.ProjectId,
                task.Title,
                task.Description,
                task.Status.ToString(),
                task.Priority.ToString(),
                task.AssigneeId,
                task.SprintId,
                task.DueDateUtc,
                task.CompletedAtUtc))
            .ToList();
    }
}
