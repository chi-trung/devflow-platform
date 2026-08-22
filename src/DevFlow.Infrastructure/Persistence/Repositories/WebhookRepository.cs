using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

internal sealed class WebhookRepository(DevFlowDbContext dbContext) : IWebhookRepository
{
    public async Task<IReadOnlyList<Webhook>> GetByWorkspaceIdAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Webhooks
            .Where(w => w.WorkspaceId == workspaceId && w.IsActive)
            .OrderByDescending(w => w.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<Webhook?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Webhooks.FindAsync([id], cancellationToken);
    }

    public async Task AddAsync(Webhook webhook, CancellationToken cancellationToken = default)
    {
        await dbContext.Webhooks.AddAsync(webhook, cancellationToken);
    }

    public void Remove(Webhook webhook)
    {
        dbContext.Webhooks.Remove(webhook);
    }
}
