using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class ActivityLogRepository(DevFlowDbContext dbContext) : IActivityLogRepository
{
    public async Task AddAsync(ActivityLog activityLog, CancellationToken cancellationToken = default)
    {
        await dbContext.ActivityLogs.AddAsync(activityLog, cancellationToken);
    }

    public async Task<IReadOnlyList<ActivityLog>> GetForProjectAsync(
        Guid projectId,
        int take,
        CancellationToken cancellationToken = default)
    {
        var logs = await dbContext.ActivityLogs
            .AsNoTracking()
            .Where(activity => activity.ProjectId == projectId)
            .OrderByDescending(activity => activity.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);

        return logs;
    }
}
