using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class OutboxMessage : BaseEntity
{
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

    public void MarkProcessed() => ProcessedAtUtc = DateTimeOffset.UtcNow;

    public void IncrementRetry(string? error = null)
    {
        RetryCount++;
        Error = error;
    }
}
