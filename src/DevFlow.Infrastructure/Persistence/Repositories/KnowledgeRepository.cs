using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class KnowledgeRepository(DevFlowDbContext dbContext) : IKnowledgeRepository
{
    public async Task AddAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default)
    {
        await dbContext.KnowledgeEntries.AddAsync(entry, cancellationToken);
    }

    public Task<KnowledgeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.KnowledgeEntries.FirstOrDefaultAsync(k => k.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<KnowledgeEntry>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var entries = await dbContext.KnowledgeEntries
            .AsNoTracking()
            .Where(k => k.ProjectId == projectId)
            .OrderByDescending(k => k.Weight)
            .ThenByDescending(k => k.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return entries;
    }

    public async Task<IReadOnlyList<KnowledgeEntry>> GetForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        var entries = await dbContext.KnowledgeEntries
            .Where(k => k.TaskId == taskId)
            .ToListAsync(cancellationToken);

        return entries;
    }

    public Task RemoveAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default)
    {
        dbContext.KnowledgeEntries.Remove(entry);
        return Task.CompletedTask;
    }
}