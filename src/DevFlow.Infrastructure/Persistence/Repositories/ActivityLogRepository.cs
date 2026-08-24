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

    public async Task<ActivityLogPage> GetFilteredAsync(
        Guid projectId,
        Guid? actorUserId,
        Guid? taskItemId,
        string? action,
        DateTimeOffset? fromUtc,
        DateTimeOffset? toUtc,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.ActivityLogs
            .AsNoTracking()
            .Where(a => a.ProjectId == projectId);

        if (actorUserId.HasValue)
            query = query.Where(a => a.ActorUserId == actorUserId.Value);

        if (taskItemId.HasValue)
            query = query.Where(a => a.TaskItemId == taskItemId.Value);

        if (!string.IsNullOrWhiteSpace(action))
            query = query.Where(a => a.Action == action);

        if (fromUtc.HasValue)
            query = query.Where(a => a.CreatedAtUtc >= fromUtc.Value);

        if (toUtc.HasValue)
            query = query.Where(a => a.CreatedAtUtc <= toUtc.Value);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(a => a.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return new ActivityLogPage(items, totalCount);
    }
}
