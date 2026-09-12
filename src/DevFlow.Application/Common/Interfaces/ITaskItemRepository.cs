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

    /// <summary>
    /// Highest sequence number ever used in the project (0 when empty). Ignores
    /// the soft-delete filter — deleted tasks keep occupying their number, so
    /// the next created task must not reuse it.
    /// </summary>
    Task<int> GetMaxNumberAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(TaskItem task, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Assignee's tasks limited to one workspace (team report). Keeps the
    /// report's task columns in the same scope as its minutes column —
    /// otherwise a user in two workspaces inflates this workspace's report.
    /// </summary>
    Task<IReadOnlyList<TaskItem>> GetAssignedInWorkspaceAsync(
        Guid assigneeId, Guid workspaceId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskItem>> GetSubtasksAsync(Guid parentTaskId, CancellationToken cancellationToken = default);
}
