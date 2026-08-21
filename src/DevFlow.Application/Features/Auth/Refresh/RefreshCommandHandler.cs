using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.Refresh;

public sealed class RefreshCommandHandler(
    IRefreshTokenRepository refreshTokenRepository,
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    ITokenProvider tokenProvider) : IRequestHandler<RefreshCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(RefreshCommand command, CancellationToken cancellationToken)
    {
        var storedToken = await refreshTokenRepository.GetByTokenAsync(command.RefreshToken, cancellationToken)
            ?? throw new UnauthorizedAccessException("Invalid refresh token.");

        if (!storedToken.IsActive)
        {
            throw new UnauthorizedAccessException("Refresh token is expired or revoked.");
        }

        var user = await userRepository.GetByIdAsync(storedToken.UserId, cancellationToken)
            ?? throw new UnauthorizedAccessException("Invalid refresh token.");

        storedToken.Revoke(DateTimeOffset.UtcNow);

        var newAccessToken = tokenProvider.GenerateAccessToken(user);
        var newRefreshToken = RefreshToken.Create(
            user.Id,
            tokenProvider.GenerateRefreshToken(),
            DateTimeOffset.UtcNow.AddDays(7));

        await refreshTokenRepository.AddAsync(newRefreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(newAccessToken, newRefreshToken.Token);
    }
}
