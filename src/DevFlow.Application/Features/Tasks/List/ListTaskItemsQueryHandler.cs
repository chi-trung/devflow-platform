using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.List;

public sealed class ListTaskItemsQueryHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository) : IRequestHandler<ListTaskItemsQuery, PagedResult<TaskItemResponse>>
{
    public async Task<PagedResult<TaskItemResponse>> Handle(
        ListTaskItemsQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        // Clamp page values
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var skip = (page - 1) * pageSize;

        var totalCount = await taskItemRepository.GetCountForProjectAsync(
            query.ProjectId, query.Status, cancellationToken);

        var tasks = await taskItemRepository.GetForProjectPagedAsync(
            query.ProjectId, query.Status, skip, pageSize, cancellationToken);

        var items = tasks
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

        return new PagedResult<TaskItemResponse>(items, totalCount, page, pageSize);
    }
}
