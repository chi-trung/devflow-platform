using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IActivityLogRepository
{
    Task AddAsync(ActivityLog activityLog, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ActivityLog>> GetForProjectAsync(
        Guid projectId,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ActivityLog>> GetForProjectsAsync(
        IEnumerable<Guid> projectIds,
        int takePerProject,
        CancellationToken cancellationToken = default);

    Task<ActivityLogPage> GetFilteredAsync(
        Guid projectId,
        Guid? actorUserId,
        Guid? taskItemId,
        string? action,
        DateTimeOffset? fromUtc,
        DateTimeOffset? toUtc,
        int skip,
        int take,
        CancellationToken cancellationToken = default);
}

public sealed record ActivityLogPage(
    IReadOnlyList<ActivityLog> Items,
    int TotalCount);
