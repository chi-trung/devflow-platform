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
}
