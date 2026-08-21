using MediatR;

namespace DevFlow.Application.Features.Auth.Register;

public sealed record RegisterCommand(
    string Email,
    string Username,
    string Password,
    string DisplayName) : IRequest<Guid>;
