using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.OAuth;

public sealed record OAuthExchangeCommand(
    string Provider,
    string Code,
    string CodeVerifier) : IRequest<LoginResponse>;

public sealed class OAuthExchangeCommandHandler(
    IExternalIdentityProvider identityProvider,
    IUserRepository userRepository,
    ISocialLoginRepository socialLoginRepository,
    IRefreshTokenRepository refreshTokenRepository,
    ITokenProvider tokenProvider,
    IUnitOfWork unitOfWork) : IRequestHandler<OAuthExchangeCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(
        OAuthExchangeCommand command,
        CancellationToken cancellationToken)
    {
        var provider = command.Provider.Trim().ToLowerInvariant();
        var identity = await identityProvider.GetProfileAsync(
            provider,
            command.Code,
            command.CodeVerifier,
            cancellationToken);

        var email = identity.Email.Trim().ToLowerInvariant();

        // 1. Find the DevFlow user linked to this provider account.
        var login = await socialLoginRepository.GetByProviderAsync(
            provider,
            identity.Subject,
            cancellationToken);

        var user = login is not null
            ? await userRepository.GetByIdAsync(login.UserId, cancellationToken)
            : null;

        // 2. First time signing in: create the account (and link).
        if (user is null)
        {
            user = await userRepository.GetByEmailAsync(email, cancellationToken);

            if (user is null)
            {
                var username = BuildUsername(email);
                user = User.Create(
                    email,
                    username,
                    // OAuth users have no password; store an unrecoverable random
                    // placeholder so the password path can never be used on them.
                    new string('#', 60),
                    string.IsNullOrWhiteSpace(identity.Name) ? username : identity.Name.Trim());
                await userRepository.AddAsync(user, cancellationToken);
            }

            await socialLoginRepository.AddAsync(
                SocialLogin.Create(user.Id, provider, identity.Subject),
                cancellationToken);
        }

        // 3. Issue the normal DevFlow session tokens.
        var accessToken = tokenProvider.GenerateAccessToken(user);
        var refreshToken = RefreshToken.Create(
            user.Id,
            tokenProvider.GenerateRefreshToken(),
            DateTimeOffset.UtcNow.AddDays(7));
        await refreshTokenRepository.AddAsync(refreshToken, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(accessToken, refreshToken.Token);
    }

    private static string BuildUsername(string email)
    {
        var localPart = email.Split('@')[0].Trim().ToLowerInvariant();
        var safe = new string(localPart.Where(char.IsLetterOrDigit).ToArray());
        return string.IsNullOrWhiteSpace(safe) ? $"user{Guid.NewGuid():N}"[..12] : safe;
    }
}
