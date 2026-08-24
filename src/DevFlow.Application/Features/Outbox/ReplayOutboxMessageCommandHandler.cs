using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

public sealed class ReplayOutboxMessageCommandHandler(
    IOutboxRepository outboxRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ReplayOutboxMessageCommand>
{
    public async Task Handle(ReplayOutboxMessageCommand command, CancellationToken cancellationToken)
    {
        var message = await outboxRepository.GetByIdAsync(command.MessageId, cancellationToken);

        if (message is null)
        {
            throw new NotFoundException(nameof(OutboxMessage), command.MessageId);
        }

        if (OutboxMessage.ResolveWorkspaceId(message.Type, message.Payload) != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(OutboxMessage), command.MessageId);
        }

        if (!message.HasFailedPermanently)
        {
            // Nothing to replay — the message is still in flight (or already delivered).
            return;
        }

        await outboxRepository.ReplayAsync(command.MessageId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
