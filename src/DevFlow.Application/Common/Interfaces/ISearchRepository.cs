using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Search;

namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// DB-level search over workspace-scoped entities. All queries are issued
/// against the workspace's project IDs so results stay within a workspace,
/// and keyword filtering happens in PostgreSQL (ILIKE) instead of in-memory.
/// </summary>
public interface ISearchRepository
{
    Task<PagedSearchItems<TaskItemSearchRow>> SearchTasksAsync(
        Guid workspaceId,
        string keyword,
        TaskItemSearchFilters filters,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<ProjectSearchRow>> SearchProjectsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EpicSearchRow>> SearchEpicsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<LabelSearchRow>> SearchLabelsAsync(
        Guid workspaceId,
        string keyword,
        int take,
        CancellationToken cancellationToken = default);

    Task<PagedSearchItems<CommentSearchRow>> SearchCommentsAsync(
        Guid workspaceId,
        string keyword,
        int skip,
        int take,
        CancellationToken cancellationToken = default);
}
