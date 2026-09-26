using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Auth.ForgotPassword;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Features.Auth.ResetPassword;

public sealed class ResetPasswordCommandHandler(
    IPasswordResetTokenRepository resetTokenRepository,
    IUserRepository userRepository,
    IRefreshTokenRepository refreshTokenRepository,
    IPasswordHasher passwordHasher,
    IUnitOfWork unitOfWork,
    ILogger<ResetPasswordCommandHandler> logger) : IRequestHandler<ResetPasswordCommand, Unit>
{
    public async Task<Unit> Handle(ResetPasswordCommand command, CancellationToken cancellationToken)
    {
        var hash = PasswordResetTokenHasher.Hash(command.Token);

        var token = await resetTokenRepository.GetByTokenHashAsync(hash, cancellationToken);

        // One message for "never existed", "expired", "already used" and
        // "revoked by a newer request". Distinguishing them would tell an
        // attacker holding a stale link whether their guess was ever right.
        if (token is null || !token.IsActive)
        {
            logger.LogWarning("Password reset attempted with an invalid or spent token.");
            throw InvalidToken();
        }

        var user = await userRepository.GetByIdAsync(token.UserId, cancellationToken);
        if (user is null)
        {
            // The account was deleted between the mail going out and the link
            // being clicked. Same response as a bad token for the same reason.
            logger.LogWarning("Password reset token {TokenId} points at a missing user.", token.Id);
            throw InvalidToken();
        }

        // Burning the token BEFORE checking anything else keeps a replay from
        // ever reaching the hashing step.
        token.MarkUsed(DateTimeOffset.UtcNow);

        user.UpdatePasswordHash(passwordHasher.Hash(command.NewPassword));

        // Resetting is the one moment a user proves they still own the mailbox
        // for a possibly-compromised account, so every other session goes. The
        // sessions die here rather than in a follow-up request because this is
        // the only request that carries proof it was not the attacker.
        var revoked = await refreshTokenRepository.RevokeAllForUserAsync(user.Id, cancellationToken);

        // An OAuth account arrives here with a placeholder hash it can never
        // log in with. Setting a real one is what converts "Google-only" into
        // "Google or password", which is the whole point of allowing it.
        user.MarkEmailVerified();

        await unitOfWork.SaveChangesAsync(cancellationToken);

        logger.LogInformation(
            "Password reset completed for {UserId}; {RevokedSessions} other session(s) revoked.",
            user.Id,
            revoked);

        return Unit.Value;
    }

    private static ValidationException InvalidToken() => new(
        new Dictionary<string, string[]>
        {
            ["token"] = ["This password reset link is invalid or has expired. Request a new one."],
        });
}
