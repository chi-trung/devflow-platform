using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Outbox;

public sealed class OutboxDispatcher(
    IOutboxRepository outboxRepository,
    IUnitOfWork unitOfWork,
    ILogger<OutboxDispatcher> logger) : IOutboxDispatcher
{
    public async Task EnqueueAsync(string type, object payload, CancellationToken cancellationToken = default)
    {
        try
        {
            var serializedPayload = System.Text.Json.JsonSerializer.Serialize(payload);
            var message = new DevFlow.Domain.Entities.OutboxMessage(type, serializedPayload);
            await outboxRepository.AddAsync(message, cancellationToken);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to enqueue outbox message of type {Type}", type);
        }
    }
}
