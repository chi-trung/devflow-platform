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
        // EndDateUtc is nullable and Postgres sorts NULLs FIRST for DESC — a
        // handful of unscheduled backlog sprints used to occupy the Take(10)
        // window and crowd the recently-completed sprints out of the velocity
        // report entirely. Schedule-less sprints sort last instead.
        return await dbContext.Sprints
            .AsNoTracking()
            .Where(s => s.ProjectId == projectId)
            .OrderByDescending(s => s.EndDateUtc.HasValue)
            .ThenByDescending(s => s.EndDateUtc)
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
