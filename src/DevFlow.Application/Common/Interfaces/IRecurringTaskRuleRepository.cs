using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IRecurringTaskRuleRepository
{
    Task AddAsync(RecurringTaskRule rule, CancellationToken cancellationToken = default);

    /// <summary>Tracked load — callers mutate NextOccurrenceUtc / cadence and save.</summary>
    Task<RecurringTaskRule?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<RecurringTaskRule>> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Active rules with NextOccurrenceUtc ≤ asOfUtc, ordered by cursor.
    /// Tracked so TryAdvanceFrom mutations persist on SaveChanges.
    /// </summary>
    Task<IReadOnlyList<RecurringTaskRule>> GetDueAsync(
        DateTimeOffset asOfUtc,
        int batchSize,
        CancellationToken cancellationToken = default);

    Task RemoveAsync(RecurringTaskRule rule, CancellationToken cancellationToken = default);
}
