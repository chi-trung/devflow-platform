using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

public sealed class PurgeDeadLetterMessagesCommandHandler(
    IOutboxRepository outboxRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<PurgeDeadLetterMessagesCommand, PurgeDeadLetterResponse>
{
    public async Task<PurgeDeadLetterResponse> Handle(
        PurgeDeadLetterMessagesCommand command,
        CancellationToken cancellationToken)
    {
        var messages = await outboxRepository.GetAllDeadLetteredAsync(cancellationToken);
        var workspaceIds = messages
            .Where(m => OutboxMessage.ResolveWorkspaceId(m.Type, m.Payload) == command.WorkspaceId)
            .Select(m => m.Id)
            .ToList();

        if (workspaceIds.Count == 0)
        {
            return new PurgeDeadLetterResponse(0);
        }

        var deleted = await outboxRepository.PurgeDeadLetteredAsync(workspaceIds, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new PurgeDeadLetterResponse(deleted);
    }
}