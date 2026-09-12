using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TimeEntryRepository(DevFlowDbContext dbContext) : ITimeEntryRepository
{
    public async Task<IReadOnlyList<TimeEntry>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TimeEntries
            .Where(te => te.TaskId == taskId)
            .OrderByDescending(te => te.DateUtc)
            .ToListAsync(cancellationToken);
    }

    public Task<TimeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.TimeEntries.FirstOrDefaultAsync(te => te.Id == id, cancellationToken);
    }

    public async Task<int> GetTotalMinutesByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TimeEntries
            .Where(te => te.TaskId == taskId)
            .SumAsync(te => te.Minutes, cancellationToken);
    }

    public async Task AddAsync(TimeEntry entry, CancellationToken cancellationToken = default)
    {
        await dbContext.TimeEntries.AddAsync(entry, cancellationToken);
    }

    public void Remove(TimeEntry entry)
    {
        dbContext.TimeEntries.Remove(entry);
    }

    public async Task<IReadOnlyList<TimeEntry>> GetForTaskIdsAsync(
        IReadOnlyCollection<Guid> taskIds, CancellationToken cancellationToken = default)
    {
        if (taskIds.Count == 0)
        {
            return [];
        }

        return await dbContext.TimeEntries
            .AsNoTracking()
            .Where(te => taskIds.Contains(te.TaskId))
            .OrderByDescending(te => te.DateUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetTotalMinutesByUserIdInWorkspaceAsync(
        Guid userId, Guid workspaceId, CancellationToken cancellationToken = default)
    {
        // TaskItem carries the soft-delete query filter, so tasks soft-deleted
        // in this workspace stop contributing their minutes here too.
        var taskIdsInWorkspace = dbContext.TaskItems
            .Join(dbContext.Projects,
                t => t.ProjectId,
                p => p.Id,
                (t, p) => new { t.Id, p.WorkspaceId })
            .Where(x => x.WorkspaceId == workspaceId)
            .Select(x => x.Id);

        return await dbContext.TimeEntries
            .Where(te => te.UserId == userId && taskIdsInWorkspace.Contains(te.TaskId))
            .SumAsync(te => te.Minutes, cancellationToken);
    }
}
