using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class LabelRepository(DevFlowDbContext dbContext) : ILabelRepository
{
    public async Task AddAsync(Label label, CancellationToken cancellationToken = default)
    {
        await dbContext.Labels.AddAsync(label, cancellationToken);
    }

    public async Task<Label?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Labels.FirstOrDefaultAsync(l => l.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Label>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Labels
            .AsNoTracking()
            .Where(l => l.ProjectId == projectId)
            .OrderBy(l => l.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task RemoveAsync(Label label, CancellationToken cancellationToken = default)
    {
        // Remove all task-label assignments first
        var taskLabels = await dbContext.TaskLabels
            .Where(tl => tl.LabelId == label.Id)
            .ToListAsync(cancellationToken);

        dbContext.TaskLabels.RemoveRange(taskLabels);
        dbContext.Labels.Remove(label);
    }

    public async Task<bool> ExistsByNameInProjectAsync(Guid projectId, string name, CancellationToken cancellationToken = default)
    {
        return await dbContext.Labels
            .AnyAsync(l => l.ProjectId == projectId && l.Name == name, cancellationToken);
    }

    public async Task AddTaskLabelAsync(TaskLabel taskLabel, CancellationToken cancellationToken = default)
    {
        if (!await TaskHasLabelAsync(taskLabel.TaskItemId, taskLabel.LabelId, cancellationToken))
        {
            await dbContext.TaskLabels.AddAsync(taskLabel, cancellationToken);
        }
    }

    public async Task RemoveTaskLabelAsync(Guid taskItemId, Guid labelId, CancellationToken cancellationToken = default)
    {
        var taskLabel = await dbContext.TaskLabels
            .FirstOrDefaultAsync(tl => tl.TaskItemId == taskItemId && tl.LabelId == labelId, cancellationToken);

        if (taskLabel is not null)
        {
            dbContext.TaskLabels.Remove(taskLabel);
        }
    }

    public async Task<IReadOnlyList<Label>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskLabels
            .AsNoTracking()
            .Where(tl => tl.TaskItemId == taskItemId)
            .Join(dbContext.Labels, tl => tl.LabelId, l => l.Id, (tl, l) => l)
            .OrderBy(l => l.Name)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> TaskHasLabelAsync(Guid taskItemId, Guid labelId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskLabels
            .AnyAsync(tl => tl.TaskItemId == taskItemId && tl.LabelId == labelId, cancellationToken);
    }
}
