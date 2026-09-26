namespace DevFlow.Api.Contracts.Auth;

/// <remarks>
/// No email field, deliberately. Collecting one let anyone register an address
/// that belonged to somebody else; the only remedy was an emailed verification
/// link, which needs a mail provider the free deployment tiers cannot run.
/// The dashboard prompts the new account to link a provider instead.
/// </remarks>
public sealed record RegisterRequest(
    string Username,
    string Password,
    string DisplayName);

/// <param name="Id">The new account's id.</param>
/// <param name="Username">The handle the account signs in with.</param>
public sealed record RegisterResponse(Guid Id, string Username);

public sealed record VerifyEmailRequest(string Token);

public sealed record ResendVerificationRequest(string Email);

public sealed record ForgotPasswordRequest(string Email);

public sealed record ResetPasswordRequest(string Token, string NewPassword);

public sealed record LoginRequest(string Username, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record UpdateProfileRequest(string DisplayName, string Username);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserProfileResponse(Guid Id, string? Email, string Username, string? DisplayName, string? AvatarUrl);

public sealed record OAuthExchangeRequest(string Provider, string Code, string CodeVerifier);

/// <remarks>
/// Link request for an account that is already signed in. The target account
/// is never taken from this body — it comes from the bearer token — so a
/// caller cannot attach a provider to somebody else's account.
/// </remarks>
public sealed record OAuthLinkRequest(string Provider, string Code, string CodeVerifier);

public sealed record OAuthConfigResponse(
    bool GoogleEnabled,
    string GoogleClientId,
    string GoogleRedirectUri,
    bool GitHubEnabled,
    string GitHubClientId,
    string GitHubRedirectUri);

public sealed record HubTicketResponse(string Ticket);
