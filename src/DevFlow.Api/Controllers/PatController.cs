using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Pat;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/users/me/pat")]
public sealed class PatController(
    ISender sender,
    IUserContext userContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<PatResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> List(CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new ListPatsQuery(userContext.UserId),
            cancellationToken);

        return Ok(result);
    }

    [HttpPost]
    [ProducesResponseType(typeof(PatCreatedResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Create(
        [FromBody] CreatePatRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var result = await sender.Send(
                new CreatePatCommand(
                    userContext.UserId,
                    request.Name,
                    request.Scopes,
                    request.ExpiresAtUtc),
                cancellationToken);

            return StatusCode(StatusCodes.Status201Created, result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Revoke(Guid id, CancellationToken cancellationToken)
    {
        await sender.Send(
            new RevokePatCommand(userContext.UserId, id),
            cancellationToken);

        return NoContent();
    }
}

public sealed record CreatePatRequest(
    string Name,
    IReadOnlyList<string> Scopes,
    DateTimeOffset? ExpiresAtUtc);
