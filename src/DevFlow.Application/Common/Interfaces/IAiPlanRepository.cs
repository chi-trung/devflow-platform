using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IAiPlanRepository
{
    Task AddAsync(AiPlan plan, CancellationToken cancellationToken = default);

    Task<AiPlan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Latest plan for a task, or null if none exists.</summary>
    Task<AiPlan?> GetLatestForTaskAsync(Guid taskId, CancellationToken cancellationToken = default);

    /// <summary>All plans for a task ordered newest-first (for the history view).</summary>
    Task<IReadOnlyList<AiPlan>> GetForTaskAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<AiPlan>> GetPendingForTaskAsync(Guid taskId, CancellationToken cancellationToken = default);
}
