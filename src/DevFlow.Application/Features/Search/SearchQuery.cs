using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Search;

public sealed record SearchResult(
    IReadOnlyList<TaskItemResult> Tasks,
    IReadOnlyList<ProjectResult> Projects,
    IReadOnlyList<EpicResult> Epics,
    IReadOnlyList<LabelResult> Labels,
    IReadOnlyList<UserResult> Users,
    IReadOnlyList<CommentResult> Comments,
    SearchPagination Pagination);

/// <summary>Pagination metadata for every result group.</summary>
public sealed record SearchPagination(
    int Page,
    int PageSize,
    int TotalTasks,
    int TotalProjects,
    int TotalEpics,
    int TotalLabels,
    int TotalUsers,
    int TotalComments);

public sealed record TaskItemResult(
    Guid Id,
    string Title,
    string Status,
    string ProjectKey);

public sealed record ProjectResult(
    Guid Id,
    string Name,
    string Key,
    string Status);

public sealed record EpicResult(
    Guid Id,
    string Name,
    string ProjectKey);

public sealed record LabelResult(
    Guid Id,
    string Name,
    string Color,
    string ProjectKey);

public sealed record UserResult(
    Guid Id,
    string DisplayName,
    string Username);

public sealed record CommentResult(
    Guid Id,
    string Content,
    Guid TaskItemId,
    string TaskTitle,
    string ProjectKey);

public sealed record SearchQuery(
    Guid WorkspaceId,
    string Keyword,
    string? Status = null,
    string? Priority = null,
    Guid? AssigneeId = null,
    Guid? LabelId = null,
    DateTime? DueBefore = null,
    DateTime? DueAfter = null,
    int Page = 1,
    int PageSize = 10) : IRequest<SearchResult>, IWorkspaceRequest;

// ----- row shapes produced by ISearchRepository (Infrastructure queries) -----

public sealed record TaskItemSearchRow(
    Guid Id,
    string Title,
    string Status,
    Guid ProjectId,
    string ProjectKey);

public sealed record ProjectSearchRow(
    Guid Id,
    string Name,
    string Key,
    string Status);

public sealed record EpicSearchRow(
    Guid Id,
    string Name,
    Guid ProjectId,
    string ProjectKey);

public sealed record LabelSearchRow(
    Guid Id,
    string Name,
    string Color,
    Guid ProjectId,
    string ProjectKey);

public sealed record CommentSearchRow(
    Guid Id,
    string Content,
    Guid TaskItemId,
    string TaskTitle,
    Guid ProjectId,
    string ProjectKey);

/// <summary>Optional task filters parsed from the search query.</summary>
public sealed record TaskItemSearchFilters(
    TaskItemStatus? Status,
    TaskItemPriority? Priority,
    Guid? AssigneeId,
    Guid? LabelId,
    DateTime? DueBefore,
    DateTime? DueAfter);
