using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.Login;

public sealed class LoginCommandHandler(
    IUserRepository userRepository,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    ITokenProvider tokenProvider) : IRequestHandler<LoginCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(LoginCommand command, CancellationToken cancellationToken)
    {
        // Username, not email: registration no longer collects an address, so
        // the email is nullable and absent for most accounts. The message is
        // deliberately shape-agnostic — "Invalid username or password" for both
        // an unknown handle and a wrong password, so a wrong guess cannot tell
        // an attacker which usernames exist.
        var user = await userRepository.GetByUsernameAsync(command.Username.Trim(), cancellationToken)
            ?? throw new UnauthorizedAccessException("Invalid username or password.");

        if (!passwordHasher.Verify(command.Password, user.PasswordHash))
        {
            throw new UnauthorizedAccessException("Invalid username or password.");
        }

        // No email-verification gate. A password account has no address to
        // verify, so requiring one would lock out everyone who signed up the
        // normal way. Recovery is a dashboard prompt to link a provider, which
        // warns without blocking.

        var accessToken = tokenProvider.GenerateAccessToken(user);

        var refreshToken = RefreshToken.Create(
            user.Id,
            tokenProvider.GenerateRefreshToken(),
            DateTimeOffset.UtcNow.AddDays(7));

        await refreshTokenRepository.AddAsync(refreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(accessToken, refreshToken.Token);
    }
}
