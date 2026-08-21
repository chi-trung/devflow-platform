using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Auth.Logout;

public sealed record LogoutCommand(string RefreshToken) : IRequest;
