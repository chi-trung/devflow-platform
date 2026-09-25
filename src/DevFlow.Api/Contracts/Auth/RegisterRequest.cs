namespace DevFlow.Api.Contracts.Auth;

public sealed record RegisterRequest(
    string Email,
    string Username,
    string Password,
    string DisplayName);

/// <param name="Id">The new account's id.</param>
/// <param name="Email">The address the verification link was sent to. Echoed
/// back so the client can name it on the "check your inbox" screen without
/// making the visitor retype it.</param>
public sealed record RegisterResponse(Guid Id, string Email);

public sealed record VerifyEmailRequest(string Token);

public sealed record ResendVerificationRequest(string Email);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record UpdateProfileRequest(string DisplayName, string Username);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserProfileResponse(Guid Id, string Email, string Username, string? DisplayName, string? AvatarUrl);

public sealed record OAuthExchangeRequest(string Provider, string Code, string CodeVerifier);

public sealed record OAuthConfigResponse(
    bool GoogleEnabled,
    string GoogleClientId,
    string GoogleRedirectUri,
    bool GitHubEnabled,
    string GitHubClientId,
    string GitHubRedirectUri);

public sealed record HubTicketResponse(string Ticket);
