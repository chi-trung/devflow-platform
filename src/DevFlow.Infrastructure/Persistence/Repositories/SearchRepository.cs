using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Search;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class SearchRepository(DevFlowDbContext dbContext) : ISearchRepository
{
    public async Task<PagedSearchItems<TaskItemSearchRow>> SearchTasksAsync(
        Guid workspaceId,
        string keyword,
        TaskItemSearchFilters filters,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var baseQuery = dbContext.TaskItems
            .AsNoTracking()
            .Join(
                dbContext.Projects.Where(p => p.WorkspaceId == workspaceId),
                task => task.ProjectId,
                project => project.Id,
                (task, project) => new { Task = task, ProjectKey = project.Key });

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            baseQuery = baseQuery.Where(x =>
                EF.Functions.ILike(x.Task.Title, $"%{keyword}%") ||
                (x.Task.Description != null && EF.Functions.ILike(x.Task.Description, $"%{keyword}%")));
        }

        if (filters.Status is not null)
        {
            baseQuery = baseQuery.Where(x => x.Task.Status == filters.Status);
        }

        if (filters.Priority is not null)
        {
            baseQuery = baseQuery.Where(x => x.Task.Priority == filters.Priority);
        }

        if (filters.AssigneeId is not null)
        {
            baseQuery = baseQuery.Where(x => x.Task.AssigneeId == filters.AssigneeId);
        }

        if (filters.DueBefore is not null)
        {
            baseQuery = baseQuery.Where(x => x.Task.DueDateUtc.HasValue && x.Task.DueDateUtc <= filters.DueBefore);
        }

        if (filters.DueAfter is not null)
        {
            baseQuery = baseQuery.Where(x => x.Task.DueDateUtc.HasValue && x.Task.DueDateUtc >= filters.DueAfter);
        }

        if (filters.LabelId is not null)
        {
            baseQuery = baseQuery.Where(x => dbContext.TaskLabels.Any(tl => tl.TaskItemId == x.Task.Id && tl.LabelId == filters.LabelId));
        }

        var total = await baseQuery.CountAsync(cancellationToken);

        var page = await baseQuery
            .OrderByDescending(x => x.Task.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .Select(x => new TaskItemSearchRow(
                x.Task.Id,
                x.Task.Title,
                x.Task.Status.ToString(),
                x.Task.ProjectId,
                x.ProjectKey))
            .ToListAsync(cancellationToken);

        return new PagedSearchItems<TaskItemSearchRow>(page, total);
    }

    public async Task<IReadOnlyList<ProjectSearchRow>> SearchProjectsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Projects
            .AsNoTracking()
            .Where(p => p.WorkspaceId == workspaceId);

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(p =>
                EF.Functions.ILike(p.Name, $"%{keyword}%") ||
                EF.Functions.ILike(p.Key, $"%{keyword}%"));
        }

        var page = await query
            .OrderBy(p => p.Name)
            .Take(take)
            .Select(p => new ProjectSearchRow(p.Id, p.Name, p.Key, p.Status.ToString()))
            .ToListAsync(cancellationToken);

        return page;
    }

    public async Task<IReadOnlyList<EpicSearchRow>> SearchEpicsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Epics
            .AsNoTracking()
            .Join(
                dbContext.Projects.Where(p => p.WorkspaceId == workspaceId),
                epic => epic.ProjectId,
                project => project.Id,
                (epic, project) => new { Epic = epic, ProjectKey = project.Key });

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x => EF.Functions.ILike(x.Epic.Name, $"%{keyword}%"));
        }

        var page = await query
            .OrderBy(x => x.Epic.Name)
            .Take(take)
            .Select(x => new EpicSearchRow(x.Epic.Id, x.Epic.Name, x.Epic.ProjectId, x.ProjectKey))
            .ToListAsync(cancellationToken);

        return page;
    }

    public async Task<IReadOnlyList<LabelSearchRow>> SearchLabelsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Labels
            .AsNoTracking()
            .Join(
                dbContext.Projects.Where(p => p.WorkspaceId == workspaceId),
                label => label.ProjectId,
                project => project.Id,
                (label, project) => new { Label = label, ProjectKey = project.Key });

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x => EF.Functions.ILike(x.Label.Name, $"%{keyword}%"));
        }

        var page = await query
            .OrderBy(x => x.Label.Name)
            .Take(take)
            .Select(x => new LabelSearchRow(x.Label.Id, x.Label.Name, x.Label.Color, x.Label.ProjectId, x.ProjectKey))
            .ToListAsync(cancellationToken);

        return page;
    }

    public async Task<PagedSearchItems<CommentSearchRow>> SearchCommentsAsync(
        Guid workspaceId,
        string keyword,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Comments
            .AsNoTracking()
            .Join(
                dbContext.TaskItems,
                comment => comment.TaskItemId,
                task => task.Id,
                (comment, task) => new { Comment = comment, Task = task })
            .Join(
                dbContext.Projects.Where(p => p.WorkspaceId == workspaceId),
                x => x.Task.ProjectId,
                project => project.Id,
                (x, project) => new { x.Comment, x.Task, ProjectKey = project.Key });

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x => EF.Functions.ILike(x.Comment.Content, $"%{keyword}%"));
        }

        var total = await query.CountAsync(cancellationToken);

        var page = await query
            .OrderByDescending(x => x.Comment.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .Select(x => new CommentSearchRow(
                x.Comment.Id,
                x.Comment.Content,
                x.Comment.TaskItemId,
                x.Task.Title,
                x.Task.ProjectId,
                x.ProjectKey))
            .ToListAsync(cancellationToken);

        return new PagedSearchItems<CommentSearchRow>(page, total);
    }
}
