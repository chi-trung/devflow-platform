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
        var unitOfWork = scope.ServiceProvider.GetRequiredService<IUnitOfWork>();

        var messages = await outboxRepository.GetUnprocessedAsync(BatchSize, cancellationToken);
        if (messages.Count == 0) return;

        logger.LogInformation("Processing {Count} outbox messages", messages.Count);

        foreach (var message in messages)
        {
            if (cancellationToken.IsCancellationRequested) break;

            try
            {
                await ProcessMessageAsync(message, webhookDispatcher, cancellationToken);
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
                var eventName = root.GetProperty("eventName").GetString() ?? message.Type;
                var data = root.GetProperty("data");

                await webhookDispatcher.DispatchAsync(workspaceId, eventName, data, cancellationToken);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Failed to dispatch outbox webhook message {Id}", message.Id);
                throw;
            }
        }
    }
}
