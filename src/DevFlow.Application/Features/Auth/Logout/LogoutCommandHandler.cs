using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Auth.Logout;

public sealed class LogoutCommandHandler(
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<LogoutCommand>
{
    public async Task Handle(LogoutCommand command, CancellationToken cancellationToken)
    {
        var storedToken = await refreshTokenRepository.GetByTokenAsync(command.RefreshToken, cancellationToken);

        if (storedToken is { IsActive: true })
        {
            storedToken.Revoke(DateTimeOffset.UtcNow);
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }
}
