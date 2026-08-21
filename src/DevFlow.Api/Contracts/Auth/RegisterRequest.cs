namespace DevFlow.Api.Contracts.Auth;

public sealed record RegisterRequest(
    string Email,
    string Username,
    string Password,
    string DisplayName);

public sealed record RegisterResponse(Guid Id);
