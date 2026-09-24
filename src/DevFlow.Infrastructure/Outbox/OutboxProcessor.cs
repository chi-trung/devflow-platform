using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Outbox;

public sealed class OutboxProcessor(
    IServiceProvider serviceProvider,
    ILogger<OutboxProcessor> logger) : BackgroundService
{
    private const int BatchSize = 32;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan InitialRetryDelay = TimeSpan.FromSeconds(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Outbox processor started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Outbox processor batch failed");
            }

            await Task.Delay(PollInterval, stoppingToken);
        }

        logger.LogInformation("Outbox processor stopped");
    }

    private async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var outboxRepository = scope.ServiceProvider.GetRequiredService<IOutboxRepository>();
        var webhookDispatcher = scope.ServiceProvider.GetService<IWebhookDispatcher>();
        var knowledgeIngestion = scope.ServiceProvider.GetService<IKnowledgeIngestionService>();
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var messages = await outboxRepository.GetUnprocessedAsync(BatchSize, cancellationToken);
        if (messages.Count == 0) return;

        logger.LogInformation("Processing {Count} outbox messages", messages.Count);

        foreach (var message in messages)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                await ProcessMessageAsync(message, webhookDispatcher, knowledgeIngestion, cancellationToken);
                await outboxRepository.MarkProcessedAsync(message.Id, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (Exception ex)
            {
                var delay = InitialRetryDelay * (1 << Math.Min(message.RetryCount, 6));
                logger.LogWarning(
                    ex,
                    "Outbox message {Id} failed (retry {Retry}), backing off {Delay}s",
                    message.Id,
                    message.RetryCount + 1,
                    delay.TotalSeconds);

                await Task.Delay(delay, cancellationToken);

                await outboxRepository.IncrementRetryAsync(message.Id, ex.Message, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
    }

    private async Task ProcessMessageAsync(
        DevFlow.Domain.Entities.OutboxMessage message,
        IWebhookDispatcher? webhookDispatcher,
        IKnowledgeIngestionService? knowledgeIngestion,
        CancellationToken cancellationToken)
    {
        if (message.Type.StartsWith("webhook.", StringComparison.OrdinalIgnoreCase))
        {
            if (webhookDispatcher is null) return;

            try
            {
                using var doc = JsonDocument.Parse(message.Payload);
                var root = doc.RootElement;

                var workspaceId = root.GetProperty("workspaceId").GetGuid();
                // Subscribers store the bare ("webhook."-stripped) discriminator.
                // Falling back to message.Type would match no webhook list, and
                // the message would then be marked processed — the event lost
                // silently. Strip the prefix so the fallback speaks the same
                // spelling as the payload.
                var eventName = root.GetProperty("eventName").GetString()
                    ?? (message.Type.StartsWith("webhook.", StringComparison.OrdinalIgnoreCase)
                        ? message.Type.Substring("webhook.".Length)
                        : message.Type);
                var data = root.GetProperty("data");

                await webhookDispatcher.DispatchAsync(workspaceId, eventName, data, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to dispatch outbox webhook message {Id}", message.Id);
                throw;
            }

            return;
        }

        if (string.Equals(message.Type, "knowledge.reembed", StringComparison.OrdinalIgnoreCase))
        {
            // Without a handler this branch would fall through and the message
            // would be marked processed with zero work done — the embedding
            // silently never happens. Throw when the service is missing so the
            // message retries instead of vanishing.
            if (knowledgeIngestion is null)
            {
                throw new InvalidOperationException(
                    "IKnowledgeIngestionService is not registered; cannot process knowledge.reembed.");
            }

            try
            {
                using var doc = JsonDocument.Parse(message.Payload);
                var entryId = doc.RootElement.GetProperty("knowledgeEntryId").GetGuid();
                await knowledgeIngestion.ReingestEntryAsync(entryId, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to re-embed knowledge for outbox message {Id}", message.Id);
                throw;
            }
        }

        // Unknown types: mark processed (same as before) so a stray message
        // cannot wedge the queue.
    }
}
