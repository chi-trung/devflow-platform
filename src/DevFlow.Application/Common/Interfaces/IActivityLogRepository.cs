using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IActivityLogRepository
{
    Task AddAsync(ActivityLog activityLog, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ActivityLog>> GetForProjectAsync(
        Guid projectId,
        int take,
        CancellationToken cancellationToken = default);
}
