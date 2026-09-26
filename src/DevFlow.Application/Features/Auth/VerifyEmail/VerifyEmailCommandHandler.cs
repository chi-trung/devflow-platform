using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.Login;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.VerifyEmail;

public sealed class VerifyEmailCommandHandler(
    IUserRepository userRepository,
    IEmailVerificationTokenProvider tokenProvider,
    IRefreshTokenRepository refreshTokenRepository,
    IUnitOfWork unitOfWork,
    ITokenProvider sessionTokenProvider) : IRequestHandler<VerifyEmailCommand, LoginResponse>
{
    public async Task<LoginResponse> Handle(
        VerifyEmailCommand command, CancellationToken cancellationToken)
    {
        // A token that is expired, forged, or (worst of all) a session token
        // pasted from devtools all land here as null — the token carries a
        // different audience than the bearer pipeline accepts, so the two
        // kinds cannot be confused for each other.
        var userId = tokenProvider.Validate(command.Token)
            ?? throw new ValidationException(new Dictionary<string, string[]>
            {
                ["token"] = ["This verification link is invalid or has expired."],
            });

        var user = await userRepository.GetByIdAsync(userId, cancellationToken)
            ?? throw new NotFoundException(nameof(User), userId);

        // Idempotent: a user who clicks an old link after verifying, or opens
        // the link twice, still gets a working session instead of an error.
        user.MarkEmailVerified();

        // Hand back a full session immediately. The visitor has just proven
        // they own the address, which is exactly what a login would ask for,
        // so making them type their password again would be busywork — and the
        // link often gets opened on a different device than the one holding
        // the form.
        var accessToken = sessionTokenProvider.GenerateAccessToken(user);
        var refreshToken = RefreshToken.Create(
            user.Id,
            sessionTokenProvider.GenerateRefreshToken(),
            DateTimeOffset.UtcNow.AddDays(7));

        await refreshTokenRepository.AddAsync(refreshToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new LoginResponse(accessToken, refreshToken.Token);
    }
}
