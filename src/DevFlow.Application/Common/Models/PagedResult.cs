namespace DevFlow.Application.Common.Models;

/// <summary>
/// Paginated search results for one entity group. Items is a single page;
/// Total is the count of ALL matching rows (pre-pagination).
/// </summary>
public sealed record PagedSearchItems<T>(IReadOnlyList<T> Items, int Total);

/// <summary>
/// Generic paged result wrapper for list endpoints.
/// </summary>
/// <typeparam name="T">The type of items in the page.</typeparam>
public sealed record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize)
{
    public int TotalPages => (int)Math.Ceiling(TotalCount / (double)PageSize);

    public bool HasPreviousPage => Page > 1;

    public bool HasNextPage => Page < TotalPages;
}
