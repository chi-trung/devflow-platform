using DevFlow.Application.Features.Auth.Login;
using MediatR;

namespace DevFlow.Application.Features.Auth.VerifyEmail;

public sealed record VerifyEmailCommand(string Token) : IRequest<LoginResponse>;
