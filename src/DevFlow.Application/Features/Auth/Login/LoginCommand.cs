using MediatR;

namespace DevFlow.Application.Features.Auth.Login;

public sealed record LoginCommand(string Email, string Password) : IRequest<LoginResponse>;

public sealed record LoginResponse(string AccessToken, string RefreshToken);
