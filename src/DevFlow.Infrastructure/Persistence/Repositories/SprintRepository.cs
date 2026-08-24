using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class SprintRepository(DevFlowDbContext dbContext) : ISprintRepository
{
    public async Task AddAsync(Sprint sprint, CancellationToken cancellationToken = default)
    {
        await dbContext.Sprints.AddAsync(sprint, cancellationToken);
    }

    public Task<Sprint?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Sprints.FirstOrDefaultAsync(sprint => sprint.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Sprint>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        var sprints = await dbContext.Sprints
            .AsNoTracking()
            .Where(sprint => sprint.ProjectId == projectId)
            .OrderByDescending(sprint => sprint.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return sprints;
    }

    public Task RemoveAsync(Sprint sprint, CancellationToken cancellationToken = default)
    {
        dbContext.Sprints.Remove(sprint);
        return Task.CompletedTask;
    }

    public Task<bool> HasActiveSprintAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return dbContext.Sprints.AnyAsync(
            sprint => sprint.ProjectId == projectId && sprint.Status == SprintStatus.Active,
            cancellationToken);
    }
}
