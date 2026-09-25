using MediatR;

namespace DevFlow.Application.Features.Auth.ForgotPassword;

/// <summary>
/// Asks for a password reset link. Like resend-verification this carries
/// nothing back, so it is safe to call for any address.
/// </summary>
public sealed record ForgotPasswordCommand(string Email) : IRequest<Unit>;
