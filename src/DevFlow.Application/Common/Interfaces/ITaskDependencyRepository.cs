using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskDependencyRepository
{
    Task<IReadOnlyList<TaskDependency>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid blockedTaskId, Guid blockerTaskId, CancellationToken cancellationToken = default);

    Task<TaskDependency?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(TaskDependency dependency, CancellationToken cancellationToken = default);

    void Remove(TaskDependency dependency);
}
