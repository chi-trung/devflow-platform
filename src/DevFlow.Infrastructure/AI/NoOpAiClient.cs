using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.AI;

/// <summary>
/// Fallback AI client used when no API key is configured. Always returns null so
/// the planner surfaces a friendly "AI not configured" response instead of
/// crashing on Render free tier.
/// </summary>
public sealed class NoOpAiClient : IAiClient
{
    public Task<string?> PlanTaskAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<string?>(null);
    }

    public Task<string?> ExecuteActionAsync(
        string systemPrompt,
        string userContext,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult<string?>(null);
    }
}
