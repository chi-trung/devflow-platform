using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class ProjectRepository(DevFlowDbContext dbContext) : IProjectRepository
{
    public Task<bool> KeyExistsInWorkspaceAsync(Guid workspaceId, string key, CancellationToken cancellationToken = default)
    {
        return dbContext.Projects.AnyAsync(
            project => project.WorkspaceId == workspaceId && project.Key == key,
            cancellationToken);
    }

    public Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Projects.FirstOrDefaultAsync(project => project.Id == id, cancellationToken);
    }

    public Task<Project?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Projects
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(project => project.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Project>> GetForWorkspaceAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var projects = await dbContext.Projects
            .AsNoTracking()
            .Where(project => project.WorkspaceId == workspaceId)
            .OrderBy(project => project.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return projects;
    }

    public async Task AddAsync(Project project, CancellationToken cancellationToken = default)
    {
        await dbContext.Projects.AddAsync(project, cancellationToken);
    }
}
