using DevFlow.Api.Contracts.Auth;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(ISender sender) : ControllerBase
{
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.Register.RegisterCommand(
            request.Email,
            request.Username,
            request.Password,
            request.DisplayName);

        var userId = await sender.Send(command, cancellationToken);

        return StatusCode(StatusCodes.Status201Created, new RegisterResponse(userId));
    }
}
