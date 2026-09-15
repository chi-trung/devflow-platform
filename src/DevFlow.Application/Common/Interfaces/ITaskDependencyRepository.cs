using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskDependencyRepository
{
    Task<IReadOnlyList<TaskDependency>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskDependency>> GetAllByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Identity, title and status of every task that appears as either end of
    /// a dependency edge within the project, in one query. The blocked-move
    /// guard needs the full edge set at once — asking per edge would do an N+1
    /// fetch on every drag — and deliberately excludes edges' far-project
    /// endpoints: a blocker the project can't see is a blocker nobody in the
    /// project can resolve.
    /// </summary>
    Task<IReadOnlyList<DevFlow.Application.Features.Tasks.Dependencies.TaskStatusSnapshot>> GetDependencyTaskSnapshotsAsync(
        Guid projectId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid blockedTaskId, Guid blockerTaskId, CancellationToken cancellationToken = default);

    Task<TaskDependency?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(TaskDependency dependency, CancellationToken cancellationToken = default);

    void Remove(TaskDependency dependency);
}
