using DevFlow.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Recurring;

/// <summary>
/// Outbox-style poller: every tick finds active rules whose NextOccurrenceUtc
/// is due and asks MediatR to spawn one task per rule. Each spawn is its own
/// scoped command so a failure on one rule never blocks the rest of the batch.
/// </summary>
public sealed class RecurringTaskProcessor(
    IServiceProvider serviceProvider,
    ILogger<RecurringTaskProcessor> logger) : BackgroundService
{
    private const int BatchSize = 16;
    private static readonly TimeSpan PollInterval = TimeSpan.FromSeconds(15);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("Recurring task processor started");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessDueAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Recurring task processor batch failed");
            }

            try
            {
                await Task.Delay(PollInterval, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }

        logger.LogInformation("Recurring task processor stopped");
    }

    private async Task ProcessDueAsync(CancellationToken cancellationToken)
    {
        using var scope = serviceProvider.CreateScope();
        var ruleRepository = scope.ServiceProvider.GetRequiredService<IRecurringTaskRuleRepository>();
        var sender = scope.ServiceProvider.GetRequiredService<ISender>();

        var asOfUtc = DateTimeOffset.UtcNow;
        var dueRules = await ruleRepository.GetDueAsync(asOfUtc, BatchSize, cancellationToken);
        if (dueRules.Count == 0)
        {
            return;
        }

        logger.LogInformation("Spawning {Count} recurring task(s)", dueRules.Count);

        foreach (var rule in dueRules)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                break;
            }

            try
            {
                await sender.Send(
                    new DevFlow.Application.Features.Recurring.Spawn.SpawnRecurringTaskCommand(
                        rule.ProjectId,
                        rule.Id,
                        rule.NextOccurrenceUtc),
                    cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // Per-rule isolation: one bad rule (deleted project mid-tick,
                // unique-race exhaustion) must not stall the rest of the batch.
                logger.LogWarning(ex, "Spawn failed for recurring rule {RuleId}", rule.Id);
            }
        }
    }
}
