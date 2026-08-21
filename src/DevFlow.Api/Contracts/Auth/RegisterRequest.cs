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
