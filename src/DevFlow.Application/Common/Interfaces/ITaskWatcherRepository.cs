using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskWatcherRepository
{
    Task AddAsync(TaskWatcher watcher, CancellationToken cancellationToken = default);

    Task RemoveAsync(Guid taskItemId, Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskWatcher>> GetByTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid taskItemId, Guid userId, CancellationToken cancellationToken = default);
}
