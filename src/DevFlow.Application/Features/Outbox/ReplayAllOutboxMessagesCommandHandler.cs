using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

public sealed class ReplayAllOutboxMessagesCommandHandler(
    IOutboxRepository outboxRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ReplayAllOutboxMessagesCommand, ReplayAllResponse>
{
    public async Task<ReplayAllResponse> Handle(
        ReplayAllOutboxMessagesCommand command,
        CancellationToken cancellationToken)
    {
        var messages = await outboxRepository.GetAllDeadLetteredAsync(cancellationToken);
        var workspaceMessages = messages
            .Where(m => OutboxMessage.ResolveWorkspaceId(m.Type, m.Payload) == command.WorkspaceId)
            .ToList();

        var requeued = 0;
        foreach (var message in workspaceMessages)
        {
            if (await outboxRepository.ReplayAsync(message.Id, cancellationToken))
            {
                requeued++;
            }
        }

        if (requeued > 0)
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new ReplayAllResponse(requeued);
    }
}