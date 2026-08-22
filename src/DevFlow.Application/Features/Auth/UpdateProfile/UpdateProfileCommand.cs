using MediatR;

namespace DevFlow.Application.Features.Auth.UpdateProfile;

public sealed record UpdateProfileCommand(
    Guid UserId,
    string DisplayName,
    string Username) : IRequest;
