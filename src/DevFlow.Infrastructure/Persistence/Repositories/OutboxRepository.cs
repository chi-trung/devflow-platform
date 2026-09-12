using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class OutboxRepository(DevFlowDbContext context) : IOutboxRepository
{
    public async Task AddAsync(OutboxMessage message, CancellationToken cancellationToken = default)
    {
        await context.OutboxMessages.AddAsync(message, cancellationToken);
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetUnprocessedAsync(int batchSize, CancellationToken cancellationToken = default)
    {
        return await context.OutboxMessages
            .Where(m => m.ProcessedAtUtc == null &&
                        m.FailedPermanentlyAt == null &&
                        m.RetryCount < OutboxMessage.MaxRetries)
            .OrderBy(m => m.OccurredAtUtc)
            .Take(batchSize)
            .ToListAsync(cancellationToken);
    }

    public async Task MarkProcessedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var message = await context.OutboxMessages.FindAsync([id], cancellationToken);
        if (message is not null)
        {
            message.MarkProcessed();
            context.OutboxMessages.Update(message);
        }
    }

    public async Task IncrementRetryAsync(Guid id, string? error, CancellationToken cancellationToken = default)
    {
        var message = await context.OutboxMessages.FindAsync([id], cancellationToken);
        if (message is not null)
        {
            message.IncrementRetry(error);
            context.OutboxMessages.Update(message);
        }
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetDeadLetteredAsync(
        Guid workspaceId, int batchSize, CancellationToken cancellationToken = default)
    {
        // Scope in SQL, not after truncation: dead letters from OTHER workspaces
        // with newer FailedPermanentlyAt values used to fill the Take() window,
        // so this workspace's list rendered empty while its messages still
        // existed (and still got picked up by the unbounded replay-all/purge).
        // OutboxMessage has no workspace column — the payload's top-level
        // workspaceId is the only source, matched case-insensitively.
        var pattern = $"%\"workspaceId\":%{workspaceId}%";

        return await context.OutboxMessages
            .Where(m => m.FailedPermanentlyAt != null && EF.Functions.ILike(m.Payload, pattern))
            .OrderByDescending(m => m.FailedPermanentlyAt)
            .Take(batchSize)
            .ToListAsync(cancellationToken);
    }

    public async Task<OutboxMessage?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await context.OutboxMessages.FindAsync([id], cancellationToken);
    }

    public async Task<bool> ReplayAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var message = await context.OutboxMessages.FindAsync([id], cancellationToken);
        if (message is null || !message.HasFailedPermanently)
        {
            return false;
        }

        message.ResetRetry();
        context.OutboxMessages.Update(message);
        return true;
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetAllDeadLetteredAsync(CancellationToken cancellationToken = default)
    {
        return await context.OutboxMessages
            .Where(m => m.FailedPermanentlyAt != null)
            .OrderByDescending(m => m.FailedPermanentlyAt)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> PurgeDeadLetteredAsync(IReadOnlyList<Guid> ids, CancellationToken cancellationToken = default)
    {
        var messages = await context.OutboxMessages
            .Where(m => ids.Contains(m.Id))
            .ToListAsync(cancellationToken);

        context.OutboxMessages.RemoveRange(messages);
        return messages.Count;
    }
}
