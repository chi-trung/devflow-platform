using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Features.Auth.ResendVerification;

public sealed class ResendVerificationCommandHandler(
    IUserRepository userRepository,
    IEmailService emailService,
    IEmailVerificationLinkBuilder linkBuilder,
    IUnitOfWork unitOfWork,
    ILogger<ResendVerificationCommandHandler> logger) : IRequestHandler<ResendVerificationCommand, Unit>
{
    /// <summary>
    /// Gap between two links to the same address. Without it the endpoint is a
    /// cheap way to flood someone's inbox from a single IP, and Resend's free
    /// tier would run out on the attacker's account.
    /// </summary>
    private static readonly TimeSpan ResendCooldown = TimeSpan.FromSeconds(60);

    public async Task<Unit> Handle(
        ResendVerificationCommand command, CancellationToken cancellationToken)
    {
        var email = command.Email.Trim().ToLowerInvariant();

        // Unknown address and already-verified account are treated exactly
        // like success. Responding differently would turn this endpoint into
        // an oracle that tells an attacker which addresses are registered.
        var user = await userRepository.GetByEmailAsync(email, cancellationToken);
        if (user is null || user.IsEmailVerified)
        {
            return Unit.Value;
        }

        if (!user.TryRecordVerificationSent(ResendCooldown))
        {
            logger.LogInformation(
                "Skipped a verification resend for {UserId}: one went out less than {Cooldown} ago",
                user.Id,
                ResendCooldown);
            return Unit.Value;
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        var link = linkBuilder.Build(user.Id);

        // Found BY this address, so non-null by construction — see the same
        // guard in ForgotPasswordCommandHandler.
        var address = user.Email
            ?? throw new InvalidOperationException(
                $"User {user.Id} has no email but was found by one.");

        // Fire-and-forget, matching every other notification in the codebase
        // (see InviteMemberCommandHandler): the send must not decide whether
        // this call succeeds.
        _ = emailService.SendEmailVerificationAsync(address, user.DisplayName, link)
            .ContinueWith(
                task => logger.LogError(
                    task.Exception,
                    "Failed to send a verification email to {UserId}",
                    user.Id),
                TaskContinuationOptions.OnlyOnFaulted);

        return Unit.Value;
    }
}
