using MediatR;

namespace DevFlow.Application.Features.Auth.Register;

public sealed record RegisterCommand(
    string Username,
    string Password,
    string DisplayName) : IRequest<Guid>;
