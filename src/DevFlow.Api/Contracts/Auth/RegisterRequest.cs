namespace DevFlow.Api.Contracts.Auth;

public sealed record RegisterRequest(
    string Email,
    string Username,
    string Password,
    string DisplayName);

public sealed record RegisterResponse(Guid Id);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record LogoutRequest(string RefreshToken);

public sealed record UpdateProfileRequest(string DisplayName, string Username);

public sealed record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public sealed record UserProfileResponse(Guid Id, string Email, string Username, string? DisplayName);

public sealed record OAuthExchangeRequest(string Provider, string Code, string CodeVerifier);

public sealed record OAuthConfigResponse(
    bool GoogleEnabled,
    string GoogleClientId,
    string GoogleRedirectUri);
