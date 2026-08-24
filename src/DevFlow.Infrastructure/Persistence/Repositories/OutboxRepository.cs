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
}
