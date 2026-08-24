using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TaskItemRepository(DevFlowDbContext dbContext) : ITaskItemRepository
{
    public async Task AddAsync(TaskItem task, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskItems.AddAsync(task, cancellationToken);
    }

    public Task<TaskItem?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskItems.FirstOrDefaultAsync(task => task.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<TaskItem>> GetForProjectAsync(
        Guid projectId,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.TaskItems.AsNoTracking().Where(task => task.ProjectId == projectId);

        if (status is not null)
        {
            query = query.Where(task => task.Status == status);
        }

        var tasks = await query
            .OrderByDescending(task => task.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return tasks;
    }

    public async Task<IReadOnlyList<TaskItem>> GetForProjectPagedAsync(
        Guid projectId,
        TaskItemStatus? status,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.TaskItems.AsNoTracking().Where(task => task.ProjectId == projectId);

        if (status is not null)
        {
            query = query.Where(task => task.Status == status);
        }

        var tasks = await query
            .OrderBy(task => task.Position)
            .ThenByDescending(task => task.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return tasks;
    }

    public async Task<IReadOnlyList<TaskItem>> GetForProjectsAsync(
        IEnumerable<Guid> projectIds,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default)
    {
        var ids = projectIds.ToList();
        if (ids.Count == 0)
        {
            return [];
        }

        var query = dbContext.TaskItems
            .AsNoTracking()
            .Where(task => ids.Contains(task.ProjectId));

        if (status is not null)
        {
            query = query.Where(task => task.Status == status);
        }

        return await query
            .OrderByDescending(task => task.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    // Tracked on purpose: callers mutate the sprint assignment (SprintId = null)
    // and rely on change tracking persisting it with the unit of work.
    public async Task<IReadOnlyList<TaskItem>> GetForSprintAsync(Guid sprintId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskItems
            .Where(task => task.SprintId == sprintId)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetCountForProjectAsync(
        Guid projectId,
        TaskItemStatus? status,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.TaskItems.AsNoTracking().Where(task => task.ProjectId == projectId);

        if (status is not null)
        {
            query = query.Where(task => task.Status == status);
        }

        return await query.CountAsync(cancellationToken);
    }

    public async Task RemoveAsync(TaskItem task, CancellationToken cancellationToken = default)
    {
        dbContext.TaskItems.Remove(task);
        await Task.CompletedTask;
    }

    public async Task<IReadOnlyList<TaskItem>> GetByAssigneeIdAsync(Guid assigneeId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskItems
            .AsNoTracking()
            .Where(t => t.AssigneeId == assigneeId)
            .OrderByDescending(t => t.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    // Tracked on purpose: callers rely on identity resolution seeing in-memory status changes
    // (e.g. the subtask-cascade rule completing a parent when its last open child is done).
    public async Task<IReadOnlyList<TaskItem>> GetSubtasksAsync(Guid parentTaskId, CancellationToken cancellationToken = default)
    {
        return await dbContext.TaskItems
            .Where(task => task.ParentTaskId == parentTaskId)
            .OrderBy(task => task.Position)
            .ThenByDescending(task => task.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }
}
