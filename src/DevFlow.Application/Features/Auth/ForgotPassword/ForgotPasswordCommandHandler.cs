using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Features.Auth.ForgotPassword;

public sealed class ForgotPasswordCommandHandler(
    IUserRepository userRepository,
    IPasswordResetTokenRepository resetTokenRepository,
    IEmailService emailService,
    IPasswordResetTokenGenerator tokenGenerator,
    IPasswordResetLinkBuilder linkBuilder,
    IUnitOfWork unitOfWork,
    ILogger<ForgotPasswordCommandHandler> logger) : IRequestHandler<ForgotPasswordCommand, Unit>
{
    /// <summary>
    /// Gap between two links to the same address. Without it this endpoint is
    /// a cheap way to flood a stranger's inbox from one IP, and it would also
    /// burn the sender's monthly quota. 60s mirrors the verification resend.
    /// </summary>
    private static readonly TimeSpan ResetCooldown = TimeSpan.FromSeconds(60);

    /// <summary>
    /// How long a reset link stays usable. Deliberately short: the mail sits in
    /// an inbox, and a long-lived link is a long-lived key to the account.
    /// </summary>
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromMinutes(30);

    public async Task<Unit> Handle(ForgotPasswordCommand command, CancellationToken cancellationToken)
    {
        var email = command.Email.Trim().ToLowerInvariant();

        // Unknown address is reported exactly like success. Any difference in
        // the response — a 404, a faster reply, a different body — turns this
        // into a way to enumerate who has an account here.
        var user = await userRepository.GetByEmailAsync(email, cancellationToken);
        if (user is null)
        {
            logger.LogInformation("Password reset requested for an unknown address.");
            return Unit.Value;
        }

        if (!user.TryRecordPasswordResetSent(ResetCooldown))
        {
            logger.LogInformation(
                "Password reset requested for {UserId} inside the cooldown; skipping.",
                user.Id);
            return Unit.Value;
        }

        // Only the newest link is live. Without this, "request again because I
        // did not see the first mail" would leave two working keys, and a later
        // mail that arrives out of order could still be used.
        var existing = await resetTokenRepository.GetActiveByUserIdAsync(user.Id, cancellationToken);
        foreach (var token in existing)
        {
            token.Revoke(DateTimeOffset.UtcNow);
        }

        var rawToken = tokenGenerator.Generate();
        var hash = PasswordResetTokenHasher.Hash(rawToken);
        var link = linkBuilder.Build(rawToken);

        var resetToken = Domain.Entities.PasswordResetToken.Create(
            user.Id,
            hash,
            DateTimeOffset.UtcNow.Add(TokenLifetime));

        await resetTokenRepository.AddAsync(resetToken, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Persist first: if the mail fails the link is still single-use and
        // expires on its own, whereas sending first and failing to save would
        // email a token that resolves to nothing.
        _ = emailService
            .SendPasswordResetAsync(user.Email, user.DisplayName, link)
            .ContinueWith(
                task => logger.LogError(
                    task.Exception,
                    "Failed to send password reset email to {UserId}.",
                    user.Id),
                TaskContinuationOptions.OnlyOnFaulted);

        return Unit.Value;
    }
}
