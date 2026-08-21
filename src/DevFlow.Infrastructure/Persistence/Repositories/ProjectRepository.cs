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

    public async Task AddAsync(Project project, CancellationToken cancellationToken = default)
    {
        await dbContext.Projects.AddAsync(project, cancellationToken);
    }
}
