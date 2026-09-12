using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Outbox;
using DevFlow.Domain.Entities;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Outbox;

public class GetDeadLetterMessagesQueryHandlerTests
{
    private readonly IOutboxRepository _outboxRepository = Substitute.For<IOutboxRepository>();
    private readonly IReadOnlyList<OutboxMessage> _deadLettered = BuildDeadLetteredMessages();

    private static IReadOnlyList<OutboxMessage> BuildDeadLetteredMessages()
    {
        var workspaceId = Guid.Parse("7b9e0a1c-2d3f-4a5b-8c6d-7e8f9a0b1c2d");

        // Builder helper — create a message, retry to dead-letter, set payload.
        List<OutboxMessage> messages = [];

        string Payload(Guid wsId, string eventName) => System.Text.Json.JsonSerializer.Serialize(new
        {
            workspaceId = wsId,
            eventName,
            data = new { },
        });

        var msg1 = new OutboxMessage("webhook.sprint.started", Payload(workspaceId, "sprint.started"));
        for (var i = 0; i < OutboxMessage.MaxRetries; i++) msg1.IncrementRetry("HTTP 500");
        messages.Add(msg1);

        var msg2 = new OutboxMessage("webhook.sprint.started", Payload(workspaceId, "sprint.started"));
        for (var i = 0; i < OutboxMessage.MaxRetries; i++) msg2.IncrementRetry("Connection refused");
        messages.Add(msg2);

        // Different workspace — should be filtered out.
        var otherWorkspaceId = Guid.Parse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        var msg3 = new OutboxMessage("webhook.task.updated", Payload(otherWorkspaceId, "task.updated"));
        for (var i = 0; i < OutboxMessage.MaxRetries; i++) msg3.IncrementRetry("HTTP 502");
        messages.Add(msg3);

        return messages;
    }

    private static Guid WorkspaceId => Guid.Parse("7b9e0a1c-2d3f-4a5b-8c6d-7e8f9a0b1c2d");

    public GetDeadLetterMessagesQueryHandlerTests()
    {
        // The SQL window is now workspace-scoped; emulate that here so the
        // assertions below exercise the same shape a scoped repository gives.
        _outboxRepository.GetDeadLetteredAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns(ci => Task.FromResult<IReadOnlyList<OutboxMessage>>(_deadLettered
                .Where(m => OutboxMessage.ResolveWorkspaceId(m.Type, m.Payload) == (Guid?)ci[0])
                .ToList()));
    }

    [Fact]
    public async Task Handle_ReturnsOnlyMessages_ForWorkspace()
    {
        var handler = new GetDeadLetterMessagesQueryHandler(_outboxRepository);
        var workspaceId = WorkspaceId;

        var result = await handler.Handle(
            new GetDeadLetterMessagesQuery(workspaceId),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.All(result, m => Assert.Equal("webhook.sprint.started", m.Type));
        Assert.All(result, m => Assert.Equal(OutboxMessage.MaxRetries, m.RetryCount));
    }

    [Fact]
    public async Task Handle_ReturnsEmpty_WhenNoDeadLetterMessages()
    {
        _outboxRepository.GetDeadLetteredAsync(Arg.Any<Guid>(), Arg.Any<int>(), Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new GetDeadLetterMessagesQueryHandler(_outboxRepository);

        var result = await handler.Handle(
            new GetDeadLetterMessagesQuery(Guid.NewGuid()),
            CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Handle_PassesWorkspaceIdToRepository()
    {
        // The Take() window must be scoped per workspace in SQL — an unscoped
        // global window let other tenants' dead letters crowd this workspace's
        // messages out of the list (empty UI while replay-all still found them).
        var handler = new GetDeadLetterMessagesQueryHandler(_outboxRepository);

        await handler.Handle(
            new GetDeadLetterMessagesQuery(WorkspaceId, 50),
            CancellationToken.None);

        await _outboxRepository.Received(1)
            .GetDeadLetteredAsync(WorkspaceId, 50, Arg.Any<CancellationToken>());
    }
}