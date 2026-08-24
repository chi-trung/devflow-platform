using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskItemRepository
{
    Task AddAsync(TaskItem task, CancellationToken cancellationToken = default);

    Task<TaskItem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetForProjectAsync(
        Guid projectId,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetForProjectsAsync(
        IEnumerable<Guid> projectIds,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetForSprintAsync(
        Guid sprintId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetForProjectPagedAsync(
        Guid projectId,
        TaskItemStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<int> GetCountForProjectAsync(
        Guid projectId,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default);

    Task RemoveAsync(TaskItem task, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetSubtasksAsync(Guid parentTaskId, CancellationToken cancellationToken = default);
}
