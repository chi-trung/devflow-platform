using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Outbox;

public sealed class GetDeadLetterMessagesQueryHandler(
    IOutboxRepository outboxRepository) : IRequestHandler<GetDeadLetterMessagesQuery, IReadOnlyList<DeadLetterMessageDto>>
{
    public async Task<IReadOnlyList<DeadLetterMessageDto>> Handle(
        GetDeadLetterMessagesQuery query,
        CancellationToken cancellationToken)
    {
        var messages = await outboxRepository.GetDeadLetteredAsync(query.BatchSize, cancellationToken);

        return messages
            .Where(m => OutboxMessage.ResolveWorkspaceId(m.Type, m.Payload) == query.WorkspaceId)
            .Select(m => new DeadLetterMessageDto(
                m.Id,
                m.Type,
                m.OccurredAtUtc,
                m.ProcessedAtUtc,
                m.RetryCount,
                m.Error,
                m.FailedPermanentlyAt!.Value))
            .ToList();
    }
}
