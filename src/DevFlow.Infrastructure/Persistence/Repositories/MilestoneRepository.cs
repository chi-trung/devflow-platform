using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class MilestoneRepository(DevFlowDbContext dbContext) : IMilestoneRepository
{
    public async Task AddAsync(Milestone milestone, CancellationToken cancellationToken = default)
    {
        await dbContext.Milestones.AddAsync(milestone, cancellationToken);
    }

    public Task<Milestone?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Milestones.FirstOrDefaultAsync(m => m.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Milestone>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var milestones = await dbContext.Milestones
            .AsNoTracking()
            .Where(m => m.ProjectId == projectId)
            .OrderBy(m => m.TargetDateUtc)
            .ThenByDescending(m => m.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return milestones;
    }

    public Task RemoveAsync(Milestone milestone, CancellationToken cancellationToken = default)
    {
        dbContext.Milestones.Remove(milestone);
        return Task.CompletedTask;
    }
}