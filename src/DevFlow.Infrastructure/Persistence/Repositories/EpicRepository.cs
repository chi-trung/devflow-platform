using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class EpicRepository(DevFlowDbContext dbContext) : IEpicRepository
{
    public async Task AddAsync(Epic epic, CancellationToken cancellationToken = default)
    {
        await dbContext.Epics.AddAsync(epic, cancellationToken);
    }

    public Task<Epic?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Epics.FirstOrDefaultAsync(epic => epic.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Epic>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var epics = await dbContext.Epics
            .AsNoTracking()
            .Where(epic => epic.ProjectId == projectId)
            .OrderByDescending(epic => epic.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return epics;
    }

    public Task RemoveAsync(Epic epic, CancellationToken cancellationToken = default)
    {
        dbContext.Epics.Remove(epic);
        return Task.CompletedTask;
    }
}
