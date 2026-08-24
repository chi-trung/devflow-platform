using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class OutboxMessage : BaseEntity
{
    /// <summary>
    /// Maximum delivery attempts before a message is dead-lettered (failed permanently).
    /// Past this cap the message is excluded from the processor queue.
    /// </summary>
    public const int MaxRetries = 10;

    private OutboxMessage() { }

    public OutboxMessage(string type, string payload)
    {
        Type = type;
        Payload = payload;
        OccurredAtUtc = DateTimeOffset.UtcNow;
        RetryCount = 0;
    }

    public string Type { get; private set; } = string.Empty;
    public string Payload { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAtUtc { get; private set; }
    public DateTimeOffset? ProcessedAtUtc { get; private set; }
    public int RetryCount { get; private set; }
    public string? Error { get; private set; }

    /// <summary>Set when retries are exhausted — the message is dead-lettered and left for inspection.</summary>
    public DateTimeOffset? FailedPermanentlyAt { get; private set; }

    public bool HasFailedPermanently => FailedPermanentlyAt.HasValue;

    public bool CanRetry => RetryCount < MaxRetries;

    public void MarkProcessed() => ProcessedAtUtc = DateTimeOffset.UtcNow;

    public void IncrementRetry(string? error = null)
    {
        RetryCount++;
        Error = error;

        if (RetryCount >= MaxRetries)
        {
            FailedPermanentlyAt = DateTimeOffset.UtcNow;
        }
    }

    /// <summary>
    /// Resets retry state so a dead-lettered message is picked up again by the
    /// processor on the next cycle (used by the admin replay endpoint).
    /// </summary>
    public void ResetRetry()
    {
        RetryCount = 0;
        Error = null;
        FailedPermanentlyAt = null;
    }

    /// <summary>
    /// Extracts the workspace the message belongs to from its payload.
    /// Webhook payloads carry a top-level <c>workspaceId</c> (serialized camelCase).
    /// Returns null for messages without one (e.g. future non-webhook types).
    /// </summary>
    public static Guid? ResolveWorkspaceId(string type, string payload)
    {
        if (!type.StartsWith("webhook.", StringComparison.OrdinalIgnoreCase))
            return null;

        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(payload);
            var root = doc.RootElement;

            if (root.TryGetProperty("workspaceId", out var workspaceId) && workspaceId.TryGetGuid(out var id))
            {
                return id;
            }

            // Fallback: case-insensitive lookup in case the payload was serialized
            // with a different casing convention.
            foreach (var property in root.EnumerateObject())
            {
                if (string.Equals(property.Name, "workspaceId", StringComparison.OrdinalIgnoreCase)
                    && property.Value.TryGetGuid(out var fallback))
                {
                    return fallback;
                }
            }
        }
        catch (System.Text.Json.JsonException)
        {
            // Corrupt payload — caller treats it as un-scoped.
        }

        return null;
    }
}
