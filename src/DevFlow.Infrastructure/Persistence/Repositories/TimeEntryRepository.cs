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
}
