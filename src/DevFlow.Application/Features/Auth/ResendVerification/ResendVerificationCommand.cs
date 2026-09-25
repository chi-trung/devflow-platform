using MediatR;

namespace DevFlow.Application.Features.Auth.ResendVerification;

/// <summary>
/// Asks for a fresh verification link. The response carries nothing that
/// reveals whether the address exists, so this is safe to call for any email.
/// </summary>
public sealed record ResendVerificationCommand(string Email) : IRequest<Unit>;
