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

    [HttpPost("login")]
    [ProducesResponseType(typeof(Application.Features.Auth.Login.LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.Login.LoginCommand(
            request.Email,
            request.Password);

        var response = await sender.Send(command, cancellationToken);

        return Ok(response);
    }

    [HttpPost("refresh")]
    [ProducesResponseType(typeof(Application.Features.Auth.Login.LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(
        RefreshRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.Refresh.RefreshCommand(request.RefreshToken);

        var response = await sender.Send(command, cancellationToken);

        return Ok(response);
    }

    [HttpPost("logout")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Logout(
        LogoutRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(new Application.Features.Auth.Logout.LogoutCommand(request.RefreshToken), cancellationToken);

        return NoContent();
    }
}
