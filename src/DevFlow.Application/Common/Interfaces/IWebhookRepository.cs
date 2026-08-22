using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IWebhookRepository
{
    Task<IReadOnlyList<Webhook>> GetByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken = default);
    Task<Webhook?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task AddAsync(Webhook webhook, CancellationToken cancellationToken = default);
    void Remove(Webhook webhook);
}
