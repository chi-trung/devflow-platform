using DevFlow.Application.Features.Auth.Login;
using MediatR;

namespace DevFlow.Application.Features.Auth.Refresh;

public sealed record RefreshCommand(string RefreshToken) : IRequest<LoginResponse>;
