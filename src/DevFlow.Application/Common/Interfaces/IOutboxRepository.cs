using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IOutboxRepository
{
    Task AddAsync(OutboxMessage message, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<OutboxMessage>> GetUnprocessedAsync(int batchSize, CancellationToken cancellationToken = default);

    Task MarkProcessedAsync(Guid id, CancellationToken cancellationToken = default);

    Task IncrementRetryAsync(Guid id, string? error, CancellationToken cancellationToken = default);

    /// <summary>Messages whose retries were exhausted (<see cref="OutboxMessage.HasFailedPermanently"/>).</summary>
    Task<IReadOnlyList<OutboxMessage>> GetDeadLetteredAsync(int batchSize, CancellationToken cancellationToken = default);

    Task<OutboxMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resets retry state for a dead-lettered message so the next processor
    /// cycle retries it. Returns false when the message is not dead-lettered.
    /// </summary>
    Task<bool> ReplayAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Fetches ALL dead-lettered messages (no take limit) for batch ops.</summary>
    Task<IReadOnlyList<OutboxMessage>> GetAllDeadLetteredAsync(CancellationToken cancellationToken = default);

    /// <summary>Hard-deletes dead-lettered messages by id. Returns deleted count.</summary>
    Task<int> PurgeDeadLetteredAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken = default);
}
