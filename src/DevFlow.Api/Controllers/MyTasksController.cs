using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.MyTasks;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/my-tasks")]
public sealed class MyTasksController(ISender sender, IUserContext userContext) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyList<MyTaskItem>), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetMyTasks(Guid workspaceId, CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new GetMyTasksQuery(workspaceId, userContext.UserId),
            cancellationToken);

        return Ok(result);
    }
}
