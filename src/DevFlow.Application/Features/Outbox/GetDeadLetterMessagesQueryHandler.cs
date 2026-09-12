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
        var messages = await outboxRepository.GetDeadLetteredAsync(query.WorkspaceId, query.BatchSize, cancellationToken);

        // SQL already scoped the window to this workspace; the resolve-filter is
        // defense-in-depth for payloads whose workspaceId spelling the LIKE
        // pattern misses, and the Take re-applies the cap after that filter.
        return messages
            .Where(m => OutboxMessage.ResolveWorkspaceId(m.Type, m.Payload) == query.WorkspaceId)
            .Take(query.BatchSize)
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
