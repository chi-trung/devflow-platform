using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Outbox;
using DevFlow.Domain.Entities;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Outbox;

public class OutboxBatchCommandHandlerTests
{
    private readonly IOutboxRepository _outboxRepository = Substitute.For<IOutboxRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private static readonly Guid WorkspaceId = Guid.Parse("7b9e0a1c-2d3f-4a5b-8c6d-7e8f9a0b1c2d");

    private static OutboxMessage DeadLetteredMessage(Guid workspaceId, Guid? id = null)
    {
        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            workspaceId,
            eventName = "sprint.started",
            data = new { },
        });
        var message = new OutboxMessage("webhook.sprint.started", payload);
        for (var i = 0; i < OutboxMessage.MaxRetries; i++) message.IncrementRetry("HTTP 500");
        return message;
    }

    // ── Replay all ─────────────────────────────────────────────────────────

    [Fact]
    public async Task ReplayAll_ShouldResetBatch_ForWorkspace_AndReturnCount()
    {
        var ws1a = DeadLetteredMessage(WorkspaceId);
        var ws1b = DeadLetteredMessage(WorkspaceId);
        var ws2 = DeadLetteredMessage(Guid.NewGuid());

        _outboxRepository.GetAllDeadLetteredAsync(Arg.Any<CancellationToken>())
            .Returns(new List<OutboxMessage> { ws1a, ws1b, ws2 });
        _outboxRepository.ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(ci =>
            {
                var id = ci.Arg<Guid>();
                if (id == ws1a.Id) { ws1a.ResetRetry(); return true; }
                if (id == ws1b.Id) { ws1b.ResetRetry(); return true; }
                return false;
            });

        var handler = new ReplayAllOutboxMessagesCommandHandler(_outboxRepository, _unitOfWork);

        var result = await handler.Handle(
            new ReplayAllOutboxMessagesCommand(WorkspaceId),
            CancellationToken.None);

        Assert.Equal(2, result.Requeued);
        Assert.True(ws1a.CanRetry);
        Assert.True(ws1b.CanRetry);
        await _outboxRepository.Received(2).ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ReplayAll_EmptyDeadLetter_ShouldBeNoOp()
    {
        _outboxRepository.GetAllDeadLetteredAsync(Arg.Any<CancellationToken>())
            .Returns(new List<OutboxMessage>());

        var handler = new ReplayAllOutboxMessagesCommandHandler(_outboxRepository, _unitOfWork);

        var result = await handler.Handle(
            new ReplayAllOutboxMessagesCommand(WorkspaceId),
            CancellationToken.None);

        Assert.Equal(0, result.Requeued);
        await _outboxRepository.DidNotReceive().ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ── Purge ──────────────────────────────────────────────────────────────

    [Fact]
    public async Task Purge_ShouldDeleteBatch_ForWorkspace_AndReturnCount()
    {
        var ws1a = DeadLetteredMessage(WorkspaceId);
        var ws1b = DeadLetteredMessage(WorkspaceId);
        var ws2 = DeadLetteredMessage(Guid.NewGuid());

        _outboxRepository.GetAllDeadLetteredAsync(Arg.Any<CancellationToken>())
            .Returns(new List<OutboxMessage> { ws1a, ws1b, ws2 });
        _outboxRepository.PurgeDeadLetteredAsync(
                Arg.Is<IReadOnlyList<Guid>>(ids => ids.Count == 2),
                Arg.Any<CancellationToken>())
            .Returns(2);

        var handler = new PurgeDeadLetterMessagesCommandHandler(_outboxRepository, _unitOfWork);

        var result = await handler.Handle(
            new PurgeDeadLetterMessagesCommand(WorkspaceId),
            CancellationToken.None);

        Assert.Equal(2, result.Deleted);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Purge_EmptyDeadLetter_ShouldBeNoOp_WithoutSaving()
    {
        _outboxRepository.GetAllDeadLetteredAsync(Arg.Any<CancellationToken>())
            .Returns(new List<OutboxMessage>());

        var handler = new PurgeDeadLetterMessagesCommandHandler(_outboxRepository, _unitOfWork);

        var result = await handler.Handle(
            new PurgeDeadLetterMessagesCommand(WorkspaceId),
            CancellationToken.None);

        Assert.Equal(0, result.Deleted);
        await _outboxRepository.DidNotReceive().PurgeDeadLetteredAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
