using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DevFlow.Infrastructure.Persistence;

namespace DevFlow.Api.Controllers;

[ApiController]
[AllowAnonymous]
[Route("api/v1/ping")]
public sealed class PingController(DevFlowDbContext dbContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(StatusCodes.Status200OK)]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        await dbContext.Database.CanConnectAsync(cancellationToken);
        return Ok(new { status = "ok", timestamp = DateTimeOffset.UtcNow });
    }
}
