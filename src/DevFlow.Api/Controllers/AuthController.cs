using DevFlow.Api.Contracts.Auth;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DevFlow.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public sealed class AuthController(
    ISender sender,
    IUserContext userContext,
    Auth.HubTicketStore hubTicketStore) : ControllerBase
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

    /// <summary>
    /// Exchanges the bearer JWT for a one-time, 90s hub ticket used to
    /// connect to SignalR hubs. Keeps the long-lived access token out of the
    /// WebSocket query string (proxies log query strings; a burned ticket is
    /// worthless after the handshake).
    /// </summary>
    [Authorize]
    [HttpPost("hub-ticket")]
    [ProducesResponseType(typeof(HubTicketResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public IActionResult CreateHubTicket()
    {
        var ticket = hubTicketStore.Issue(userContext.UserId.ToString());
        return Ok(new HubTicketResponse(ticket));
    }

    [Authorize]
    [HttpGet("me")]
    [ProducesResponseType(typeof(UserProfileResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetMe(
        IUserRepository userRepository,
        CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
        if (user is null)
            return NotFound();

        return Ok(new UserProfileResponse(
            user.Id,
            user.Email,
            user.Username,
            user.DisplayName));
    }

    [Authorize]
    [HttpPatch("profile")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> UpdateProfile(
        UpdateProfileRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Auth.UpdateProfile.UpdateProfileCommand(
                userContext.UserId,
                request.DisplayName,
                request.Username),
            cancellationToken);

        return NoContent();
    }

    [Authorize]
    [HttpPost("change-password")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> ChangePassword(
        ChangePasswordRequest request,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.Auth.ChangePassword.ChangePasswordCommand(
                userContext.UserId,
                request.CurrentPassword,
                request.NewPassword),
            cancellationToken);

        return NoContent();
    }

    [HttpPost("oauth/exchange")]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> ExchangeOAuth(
        OAuthExchangeRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new Application.Features.Auth.OAuth.OAuthExchangeCommand(
                request.Provider,
                request.Code,
                request.CodeVerifier),
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("oauth/config")]
    [ProducesResponseType(typeof(OAuthConfigResponse), StatusCodes.Status200OK)]
    public IActionResult GetOAuthConfig(IOptions<DevFlow.Infrastructure.Authentication.OAuthSettings> options)
    {
        var settings = options.Value;
        var enabled = !string.IsNullOrWhiteSpace(settings.GoogleClientId)
            && !string.IsNullOrWhiteSpace(settings.GoogleClientSecret);

        return Ok(new OAuthConfigResponse(
            enabled,
            settings.GoogleClientId,
            settings.GoogleRedirectUri));
    }
}
