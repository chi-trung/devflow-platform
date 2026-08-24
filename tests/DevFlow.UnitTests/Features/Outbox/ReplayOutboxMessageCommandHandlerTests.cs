using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Outbox;
using DevFlow.Domain.Entities;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Outbox;

public class ReplayOutboxMessageCommandHandlerTests
{
    private readonly IOutboxRepository _outboxRepository = Substitute.For<IOutboxRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private static readonly Guid WorkspaceId = Guid.Parse("7b9e0a1c-2d3f-4a5b-8c6d-7e8f9a0b1c2d");

    private static OutboxMessage DeadLetteredMessage(Guid workspaceId = default, Guid? id = null)
    {
        var wsId = workspaceId == default ? WorkspaceId : workspaceId;
        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            workspaceId = wsId,
            eventName = "sprint.started",
            data = new { },
        });
        var message = new OutboxMessage("webhook.sprint.started", payload);
        for (var i = 0; i < OutboxMessage.MaxRetries; i++) message.IncrementRetry("HTTP 500");
        return message;
    }

    [Fact]
    public async Task Handle_ReplaysDeadLetteredMessage_AndSaves()
    {
        var message = DeadLetteredMessage();
        _outboxRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>())
            .Returns(message);

        // Mirror the real OutboxRepository.ReplayAsync — it resets retry state
        // on the tracked entity; the handler should rely on that + save.
        _outboxRepository.ReplayAsync(message.Id, Arg.Any<CancellationToken>())
            .Returns(_ =>
            {
                message.ResetRetry();
                return true;
            });

        var handler = new ReplayOutboxMessageCommandHandler(_outboxRepository, _unitOfWork);

        await handler.Handle(
            new ReplayOutboxMessageCommand(WorkspaceId, message.Id),
            CancellationToken.None);

        Assert.True(message.CanRetry);
        Assert.False(message.HasFailedPermanently);
        Assert.Null(message.FailedPermanentlyAt);
        await _outboxRepository.Received(1).ReplayAsync(message.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_DoesNotReplay_WhenMessageFromOtherWorkspace()
    {
        var message = DeadLetteredMessage(workspaceId: Guid.NewGuid());
        _outboxRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>())
            .Returns(message);

        var handler = new ReplayOutboxMessageCommandHandler(_outboxRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new ReplayOutboxMessageCommand(WorkspaceId, message.Id), CancellationToken.None));

        await _outboxRepository.DidNotReceive().ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ThrowsNotFound_WhenMessageMissing()
    {
        _outboxRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((OutboxMessage?)null);

        var handler = new ReplayOutboxMessageCommandHandler(_outboxRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new ReplayOutboxMessageCommand(WorkspaceId, Guid.NewGuid()), CancellationToken.None));

        await _outboxRepository.DidNotReceive().ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_NonDeadLettered_IsNoOp_WithoutSaving()
    {
        var payload = System.Text.Json.JsonSerializer.Serialize(new
        {
            workspaceId = WorkspaceId,
            eventName = "sprint.started",
            data = new { },
        });
        var message = new OutboxMessage("webhook.sprint.started", payload);
        message.IncrementRetry("oops");
        _outboxRepository.GetByIdAsync(message.Id, Arg.Any<CancellationToken>())
            .Returns(message);

        var handler = new ReplayOutboxMessageCommandHandler(_outboxRepository, _unitOfWork);

        await handler.Handle(
            new ReplayOutboxMessageCommand(WorkspaceId, message.Id),
            CancellationToken.None);

        await _outboxRepository.DidNotReceive().ReplayAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}