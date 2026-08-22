using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TemplateRepository(DevFlowDbContext dbContext) : ITemplateRepository
{
    public async Task<IReadOnlyList<TaskTemplate>> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskTemplates
            .Where(t => t.ProjectId == projectId)
            .OrderBy(t => t.Name)
            .ToListAsync(cancellationToken);
    }

    public Task<TaskTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskTemplates.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
    }

    public async Task AddAsync(TaskTemplate template, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskTemplates.AddAsync(template, cancellationToken);
    }

    public void Remove(TaskTemplate template)
    {
        dbContext.TaskTemplates.Remove(template);
    }
}
