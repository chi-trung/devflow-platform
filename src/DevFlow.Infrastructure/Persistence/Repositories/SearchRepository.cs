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
        TaskItemSearchSort? sort,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        // The tenant check is an existence probe rather than a join. Every
        // filter below reads TaskItem alone; joining Projects up front used to
        // project a custom row record, and EF cannot re-expand that record when
        // it reappears inside a later Where — the whole query failed to
        // translate the moment a keyword was present. The project key is fetched
        // in the final projection, where only columns are involved.
        var baseQuery = dbContext.TaskItems
            .AsNoTracking()
            .Where(task => dbContext.Projects.Any(project =>
                project.Id == task.ProjectId && project.WorkspaceId == workspaceId));

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            baseQuery = baseQuery.Where(task =>
                EF.Functions.ILike(task.Title, $"%{keyword}%") ||
                (task.Description != null && EF.Functions.ILike(task.Description, $"%{keyword}%")));
        }

        if (filters.Status is not null)
        {
            baseQuery = baseQuery.Where(task => task.Status == filters.Status);
        }

        if (filters.Priority is not null)
        {
            baseQuery = baseQuery.Where(task => task.Priority == filters.Priority);
        }

        if (filters.AssigneeId is not null)
        {
            baseQuery = baseQuery.Where(task => task.AssigneeId == filters.AssigneeId);
        }

        if (filters.DueBefore is not null)
        {
            baseQuery = baseQuery.Where(task => task.DueDateUtc.HasValue && task.DueDateUtc <= filters.DueBefore);
        }

        if (filters.DueAfter is not null)
        {
            baseQuery = baseQuery.Where(task => task.DueDateUtc.HasValue && task.DueDateUtc >= filters.DueAfter);
        }

        if (filters.LabelId is not null)
        {
            baseQuery = baseQuery.Where(task => dbContext.TaskLabels.Any(tl => tl.TaskItemId == task.Id && tl.LabelId == filters.LabelId));
        }

        var total = await baseQuery.CountAsync(cancellationToken);

        IOrderedQueryable<TaskItem> ordered = sort is not null
            ? ApplyTaskSort(baseQuery, sort)
            : baseQuery.OrderByDescending(task => task.CreatedAtUtc);

        // Select the enum, not its name. Postgres cannot translate
        // enum.ToString() into SQL, so projecting it here would fail at query
        // time the moment a keyword is present. The name is rendered in C# by
        // SearchQueryHandler, after the rows are in memory — the same shape
        // TaskItemRepository uses.
        var page = await ordered
            .Skip(skip)
            .Take(take)
            .Select(task => new TaskItemSearchRow(
                task.Id,
                task.Title,
                task.Status,
                task.ProjectId,
                dbContext.Projects
                    .Where(project => project.Id == task.ProjectId)
                    .Select(project => project.Key)
                    .First()))
            .ToListAsync(cancellationToken);

        return new PagedSearchItems<TaskItemSearchRow>(page, total);
    }

    private static IOrderedQueryable<TaskItem> ApplyTaskSort(IQueryable<TaskItem> query, TaskItemSearchSort sort)
    {
        return sort.Key switch
        {
            "title" => sort.Descending
                ? query.OrderByDescending(task => task.Title)
                : query.OrderBy(task => task.Title),
            "status" => sort.Descending
                ? query.OrderByDescending(task => task.Status)
                : query.OrderBy(task => task.Status),
            "priority" => sort.Descending
                ? query.OrderByDescending(task => task.Priority)
                : query.OrderBy(task => task.Priority),
            "dueDate" => sort.Descending
                ? query.OrderByDescending(task => task.DueDateUtc)
                : query.OrderBy(task => task.DueDateUtc),
            "updatedAt" => sort.Descending
                ? query.OrderByDescending(task => task.UpdatedAtUtc)
                : query.OrderBy(task => task.UpdatedAtUtc),
            _ => query.OrderByDescending(task => task.CreatedAtUtc),
        };
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

        // Same reasoning as SearchTasksAsync: the enum travels, the name is
        // rendered by the handler in memory.
        var page = await query
            .OrderBy(p => p.Name)
            .Take(take)
            .Select(p => new ProjectSearchRow(p.Id, p.Name, p.Key, p.Status))
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

    public async Task<PagedSearchItems<CustomFieldSearchRow>> SearchCustomFieldsAsync(
        Guid workspaceId,
        string keyword,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.Set<TaskCustomFieldValue>()
            .AsNoTracking()
            .Join(
                dbContext.TaskItems,
                cfv => cfv.TaskId,
                task => task.Id,
                (cfv, task) => new { cfv, task })
            .Join(
                dbContext.Projects.Where(p => p.WorkspaceId == workspaceId),
                x => x.task.ProjectId,
                project => project.Id,
                (x, project) => new { x.cfv, x.task, ProjectKey = project.Key })
            .Join(
                dbContext.Set<CustomField>(),
                x => x.cfv.FieldId,
                field => field.Id,
                (x, field) => new { x.cfv, x.task, x.ProjectKey, FieldName = field.Name });

        if (!string.IsNullOrWhiteSpace(keyword))
        {
            query = query.Where(x => EF.Functions.ILike(x.cfv.Value!, $"%{keyword}%"));
        }

        var total = await query.CountAsync(cancellationToken);

        var page = await query
            .OrderBy(x => x.task.Title)
            .Skip(skip)
            .Take(take)
            .Select(x => new CustomFieldSearchRow(
                x.task.Id,
                x.task.Title,
                x.task.ProjectId,
                x.ProjectKey,
                x.FieldName,
                x.cfv.Value))
            .ToListAsync(cancellationToken);

        return new PagedSearchItems<CustomFieldSearchRow>(page, total);
    }
}