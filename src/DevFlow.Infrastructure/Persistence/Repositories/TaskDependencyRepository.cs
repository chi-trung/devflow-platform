using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TaskDependencyRepository(DevFlowDbContext dbContext) : ITaskDependencyRepository
{
    public Task<IReadOnlyList<TaskDependency>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskDependencies
            .Where(td => td.BlockedTaskId == taskId)
            .ToListAsync(cancellationToken)
            .ContinueWith(t => (IReadOnlyList<TaskDependency>)t.Result, cancellationToken);
    }

    public Task<IReadOnlyList<TaskDependency>> GetAllByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskDependencies
            .Where(td =>
                dbContext.TaskItems.Any(t => t.ProjectId == projectId && t.Id == td.BlockedTaskId) ||
                dbContext.TaskItems.Any(t => t.ProjectId == projectId && t.Id == td.BlockerTaskId))
            .ToListAsync(cancellationToken)
            .ContinueWith(t => (IReadOnlyList<TaskDependency>)t.Result, cancellationToken);
    }

    public Task<bool> ExistsAsync(Guid blockedTaskId, Guid blockerTaskId, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskDependencies
            .AnyAsync(td => td.BlockedTaskId == blockedTaskId && td.BlockerTaskId == blockerTaskId, cancellationToken);
    }

    public Task<TaskDependency?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskDependencies.FirstOrDefaultAsync(td => td.Id == id, cancellationToken);
    }

    public async Task AddAsync(TaskDependency dependency, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskDependencies.AddAsync(dependency, cancellationToken);
    }

    public void Remove(TaskDependency dependency)
    {
        dbContext.TaskDependencies.Remove(dependency);
    }
}
