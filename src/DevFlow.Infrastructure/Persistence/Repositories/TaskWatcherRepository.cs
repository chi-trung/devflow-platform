using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TaskWatcherRepository(DevFlowDbContext dbContext) : ITaskWatcherRepository
{
    public async Task AddAsync(TaskWatcher watcher, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskWatchers.AddAsync(watcher, cancellationToken);
    }

    public async Task RemoveAsync(Guid taskItemId, Guid userId, CancellationToken cancellationToken = default)
    {
        var watcher = await dbContext.TaskWatchers
            .FirstOrDefaultAsync(w => w.TaskItemId == taskItemId && w.UserId == userId, cancellationToken);

        if (watcher is not null)
        {
            dbContext.TaskWatchers.Remove(watcher);
        }
    }

    public async Task<IReadOnlyList<TaskWatcher>> GetByTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskWatchers
            .AsNoTracking()
            .Where(w => w.TaskItemId == taskItemId)
            .ToListAsync(cancellationToken);
    }

    public Task<bool> ExistsAsync(Guid taskItemId, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskWatchers
            .AnyAsync(w => w.TaskItemId == taskItemId && w.UserId == userId, cancellationToken);
    }
}
