using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class RecurringTaskRuleRepository(DevFlowDbContext dbContext) : IRecurringTaskRuleRepository
{
    public async Task AddAsync(RecurringTaskRule rule, CancellationToken cancellationToken = default)
    {
        await dbContext.RecurringTaskRules.AddAsync(rule, cancellationToken);
    }

    // Tracked on purpose: spawn/update mutate NextOccurrenceUtc and rely on
    // the change tracker to persist the CAS advance with the inserted task.
    public Task<RecurringTaskRule?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.RecurringTaskRules.FirstOrDefaultAsync(rule => rule.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<RecurringTaskRule>> GetByProjectIdAsync(
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RecurringTaskRules
            .AsNoTracking()
            .Where(rule => rule.ProjectId == projectId)
            .OrderBy(rule => rule.Title)
            .ThenBy(rule => rule.Id)
            .ToListAsync(cancellationToken);
    }

    // Tracked on purpose — the processor advances NextOccurrenceUtc on each
    // row before the shared SaveChanges that inserts the spawned task.
    public async Task<IReadOnlyList<RecurringTaskRule>> GetDueAsync(
        DateTimeOffset asOfUtc,
        int batchSize,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.RecurringTaskRules
            .Where(rule =>
                rule.IsActive
                && rule.NextOccurrenceUtc <= asOfUtc)
            .OrderBy(rule => rule.NextOccurrenceUtc)
            .ThenBy(rule => rule.Id)
            .Take(batchSize)
            .ToListAsync(cancellationToken);
    }

    public Task RemoveAsync(RecurringTaskRule rule, CancellationToken cancellationToken = default)
    {
        dbContext.RecurringTaskRules.Remove(rule);
        return Task.CompletedTask;
    }
}
