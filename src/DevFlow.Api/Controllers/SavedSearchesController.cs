using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/users/me/saved-searches")]
public sealed class SavedSearchesController(
    DevFlowDbContext dbContext,
    IUserContext userContext) : ControllerBase
{
    private const int MaxSavedSearches = 20;

    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<SavedSearchResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var searches = await dbContext.SavedSearches
            .Where(ss => ss.UserId == userContext.UserId)
            .OrderByDescending(ss => ss.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return Ok(searches.Select(MapToResponse));
    }

    [HttpPost]
    [ProducesResponseType(typeof(SavedSearchResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreateSavedSearchRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
            return BadRequest("Name is required.");

        var count = await dbContext.SavedSearches
            .CountAsync(ss => ss.UserId == userContext.UserId, cancellationToken);

        if (count >= MaxSavedSearches)
            return BadRequest($"Maximum {MaxSavedSearches} saved searches reached.");

        var search = SavedSearch.Create(userContext.UserId, request.WorkspaceId, request.Name);
        search.Query = request.Query;
        search.FiltersJson = request.FiltersJson;

        dbContext.SavedSearches.Add(search);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(Get), new { id = search.Id }, MapToResponse(search));
    }

    [HttpGet("{id:guid}")]
    [ProducesResponseType(typeof(SavedSearchResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Get(Guid id, CancellationToken cancellationToken)
    {
        var search = await dbContext.SavedSearches
            .FirstOrDefaultAsync(ss => ss.Id == id && ss.UserId == userContext.UserId, cancellationToken);

        if (search is null) return NotFound();
        return Ok(MapToResponse(search));
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var search = await dbContext.SavedSearches
            .FirstOrDefaultAsync(ss => ss.Id == id && ss.UserId == userContext.UserId, cancellationToken);

        if (search is null) return NotFound();

        dbContext.SavedSearches.Remove(search);
        await dbContext.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static SavedSearchResponse MapToResponse(SavedSearch ss) =>
        new(ss.Id, ss.Name, ss.WorkspaceId, ss.Query, ss.FiltersJson, ss.CreatedAtUtc);

    public sealed record SavedSearchResponse(
        Guid Id, string Name, Guid WorkspaceId, string Query, string? FiltersJson, DateTimeOffset CreatedAtUtc);

    public sealed record CreateSavedSearchRequest(
        string Name, Guid WorkspaceId, string Query, string? FiltersJson);
}
