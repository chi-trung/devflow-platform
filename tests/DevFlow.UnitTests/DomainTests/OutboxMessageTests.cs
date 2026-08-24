using DevFlow.Domain.Entities;
using Xunit;

namespace DevFlow.UnitTests.DomainTests;

public class OutboxMessageTests
{
    [Fact]
    public void NewMessage_StartsWithZeroRetries_AndCanRetry()
    {
        var message = new OutboxMessage("webhook.sprint.started", "{}");

        Assert.Equal(0, message.RetryCount);
        Assert.True(message.CanRetry);
        Assert.False(message.HasFailedPermanently);
        Assert.Null(message.FailedPermanentlyAt);
        Assert.Null(message.ProcessedAtUtc);
    }

    [Fact]
    public void IncrementRetry_WithinCap_KeepsMessageRetryable()
    {
        var message = new OutboxMessage("webhook.sprint.started", "{}");

        for (var i = 0; i < OutboxMessage.MaxRetries - 1; i++)
        {
            message.IncrementRetry("boom");
        }

        Assert.Equal(OutboxMessage.MaxRetries - 1, message.RetryCount);
        Assert.True(message.CanRetry);
        Assert.False(message.HasFailedPermanently);
        Assert.Null(message.FailedPermanentlyAt);
    }

    [Fact]
    public void IncrementRetry_AtCap_DeadLettersMessage()
    {
        var message = new OutboxMessage("webhook.sprint.started", "{}");

        for (var i = 0; i < OutboxMessage.MaxRetries; i++)
        {
            message.IncrementRetry("boom");
        }

        Assert.Equal(OutboxMessage.MaxRetries, message.RetryCount);
        Assert.False(message.CanRetry);
        Assert.True(message.HasFailedPermanently);
        Assert.NotNull(message.FailedPermanentlyAt);
        Assert.Equal("boom", message.Error);
    }

    [Fact]
    public void MarkProcessed_SetsProcessedAt_AndExcludesFromDeadLetter()
    {
        var message = new OutboxMessage("webhook.sprint.started", "{}");

        message.MarkProcessed();

        Assert.NotNull(message.ProcessedAtUtc);
        Assert.False(message.HasFailedPermanently);
        Assert.True(message.CanRetry);
    }
}
