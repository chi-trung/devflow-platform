using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class ReportingRepository(DevFlowDbContext dbContext) : IReportingRepository
{
    public async Task<IReadOnlyList<TaskItem>> GetTasksByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskItems
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<Sprint>> GetSprintsByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Sprints
            .AsNoTracking()
            .Where(s => s.ProjectId == projectId)
            .OrderByDescending(s => s.EndDateUtc)
            .Take(10)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<TimeEntry>> GetTimeEntriesByUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TimeEntries
            .AsNoTracking()
            .Where(te => te.UserId == userId)
            .ToListAsync(cancellationToken);
    }
}
