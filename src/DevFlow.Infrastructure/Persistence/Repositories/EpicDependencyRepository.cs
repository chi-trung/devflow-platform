using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class EpicDependencyRepository(DevFlowDbContext dbContext) : IEpicDependencyRepository
{
    public async Task AddAsync(EpicDependency dependency, CancellationToken cancellationToken = default)
    {
        await dbContext.EpicDependencies.AddAsync(dependency, cancellationToken);
    }

    public async Task RemoveAsync(Guid epicId, Guid blockedById, CancellationToken cancellationToken = default)
    {
        var dependency = await dbContext.EpicDependencies
            .FirstOrDefaultAsync(d => d.EpicId == epicId && d.BlockedById == blockedById, cancellationToken);

        if (dependency is not null)
        {
            dbContext.EpicDependencies.Remove(dependency);
        }
    }

    public async Task<IReadOnlyList<EpicDependency>> GetForEpicAsync(Guid epicId, CancellationToken cancellationToken = default)
    {
        return await dbContext.EpicDependencies
            .AsNoTracking()
            .Where(d => d.EpicId == epicId)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<EpicDependency>> GetForEpicsAsync(
        IEnumerable<Guid> epicIds, CancellationToken cancellationToken = default)
    {
        var ids = epicIds.ToList();

        if (ids.Count == 0)
        {
            return [];
        }

        return await dbContext.EpicDependencies
            .AsNoTracking()
            .Where(d => ids.Contains(d.EpicId))
            .ToListAsync(cancellationToken);
    }
}
