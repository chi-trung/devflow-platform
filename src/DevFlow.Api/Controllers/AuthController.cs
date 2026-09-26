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
    /// <summary>
    /// Creates a password account with no email attached — see the remarks on
    /// <see cref="RegisterRequest"/> for why none is collected. The response
    /// hands back the username so the client can show it on the dashboard
    /// prompt: an account with no address is only recoverable through a linked
    /// provider, and the person has to know their own handle to sign in again.
    /// </summary>
    [HttpPost("register")]
    [ProducesResponseType(typeof(RegisterResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Register(
        RegisterRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.Register.RegisterCommand(
            request.Username,
            request.Password,
            request.DisplayName);

        var userId = await sender.Send(command, cancellationToken);

        return StatusCode(
            StatusCodes.Status201Created,
            new RegisterResponse(userId, request.Username.Trim()));
    }

    /// <summary>
    /// Exchanges a link token for a session. Anonymous by design: the token in
    /// the link IS the credential, which is why this route sits under
    /// /auth and picks up the 10-per-minute limit with its neighbours.
    /// </summary>
    [HttpPost("verify-email")]
    [ProducesResponseType(typeof(Application.Features.Auth.Login.LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> VerifyEmail(
        VerifyEmailRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.VerifyEmail.VerifyEmailCommand(request.Token);

        var response = await sender.Send(command, cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// Always 202, whatever the address turns out to be — see the handler for
    /// why a different response would be a vulnerability.
    /// </summary>
    [HttpPost("resend-verification")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResendVerification(
        ResendVerificationRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.ResendVerification.ResendVerificationCommand(request.Email);

        await sender.Send(command, cancellationToken);

        return Accepted();
    }

    /// <summary>
    /// Starts a password reset. Always 202, for the same reason as
    /// resend-verification: a response that differed for a registered address
    /// would turn this into an account-enumeration oracle.
    /// </summary>
    [HttpPost("forgot-password")]
    [ProducesResponseType(StatusCodes.Status202Accepted)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ForgotPassword(
        ForgotPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.ForgotPassword.ForgotPasswordCommand(request.Email);

        await sender.Send(command, cancellationToken);

        return Accepted();
    }

    /// <summary>
    /// Redeems a reset link. A spent, expired or forged token is a 400
    /// carrying one generic message — never a session, and never a hint about
    /// which part of the token was wrong.
    /// </summary>
    [HttpPost("reset-password")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> ResetPassword(
        ResetPasswordRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.ResetPassword.ResetPasswordCommand(
            request.Token,
            request.NewPassword);

        await sender.Send(command, cancellationToken);

        return Ok();
    }

    [HttpPost("login")]
    [ProducesResponseType(typeof(Application.Features.Auth.Login.LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status403Forbidden)]
    public async Task<IActionResult> Login(
        LoginRequest request,
        CancellationToken cancellationToken)
    {
        var command = new Application.Features.Auth.Login.LoginCommand(
            request.Username,
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
            user.DisplayName,
            user.AvatarUrl));
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

    /// <summary>
    /// Attaches a Google or GitHub identity to the signed-in account — the
    /// "activate your account" step for an account registered with no address.
    /// Requires a session: unlike /oauth/exchange, the target account is the
    /// one in the token, not whoever the provider claims to be.
    /// </summary>
    [Authorize]
    [HttpPost("oauth/link")]
    [ProducesResponseType(typeof(Application.Features.Auth.OAuth.LinkedAccountsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
    public async Task<IActionResult> LinkOAuth(
        OAuthLinkRequest request,
        CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new Application.Features.Auth.OAuth.LinkOAuthCommand(
                userContext.UserId,
                request.Provider,
                request.Code,
                request.CodeVerifier),
            cancellationToken);

        return Ok(response);
    }

    /// <summary>
    /// What this account has linked, and whether a lost password could be
    /// recovered at all. The dashboard prompt reads this; see the remarks on
    /// the query for why it is not a claim on the access token.
    /// </summary>
    [Authorize]
    [HttpGet("linked-accounts")]
    [ProducesResponseType(typeof(Application.Features.Auth.OAuth.LinkedAccountsResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> GetLinkedAccounts(CancellationToken cancellationToken)
    {
        var response = await sender.Send(
            new Application.Features.Auth.OAuth.GetLinkedAccountsQuery(userContext.UserId),
            cancellationToken);

        return Ok(response);
    }

    [HttpGet("oauth/config")]
    [ProducesResponseType(typeof(OAuthConfigResponse), StatusCodes.Status200OK)]
    public IActionResult GetOAuthConfig(IOptions<DevFlow.Infrastructure.Authentication.OAuthSettings> options)
    {
        var settings = options.Value;
        var googleEnabled = !string.IsNullOrWhiteSpace(settings.GoogleClientId)
            && !string.IsNullOrWhiteSpace(settings.GoogleClientSecret);
        var githubEnabled = !string.IsNullOrWhiteSpace(settings.GitHubClientId)
            && !string.IsNullOrWhiteSpace(settings.GitHubClientSecret);

        return Ok(new OAuthConfigResponse(
            googleEnabled,
            settings.GoogleClientId,
            settings.GoogleRedirectUri,
            githubEnabled,
            settings.GitHubClientId,
            settings.GitHubRedirectUri));
    }
}
