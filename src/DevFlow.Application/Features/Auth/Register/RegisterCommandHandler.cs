using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Features.Auth.Register;

public sealed class RegisterCommandHandler(
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher,
    IEmailService emailService,
    IEmailVerificationLinkBuilder linkBuilder,
    ILogger<RegisterCommandHandler> logger) : IRequestHandler<RegisterCommand, Guid>
{
    public async Task<Guid> Handle(RegisterCommand command, CancellationToken cancellationToken)
    {
        var email = command.Email.Trim().ToLowerInvariant();

        if (await userRepository.ExistsByEmailAsync(email, cancellationToken))
        {
            throw new ConflictException($"Email \"{email}\" is already registered.");
        }

        if (await userRepository.ExistsByUsernameAsync(command.Username, cancellationToken))
        {
            throw new ConflictException($"Username \"{command.Username}\" is already taken.");
        }

        var user = User.Create(
            email,
            command.Username,
            passwordHasher.Hash(command.Password),
            command.DisplayName);

        await userRepository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Persisted first, emailed second. A mail failure must not undo the
        // registration — the user can always ask for a new link from the
        // "check your inbox" screen, whereas a rolled-back account would leave
        // them with no way forward at all.
        var link = linkBuilder.Build(user.Id);

        _ = emailService.SendEmailVerificationAsync(user.Email, user.DisplayName, link)
            .ContinueWith(
                task => logger.LogError(
                    task.Exception,
                    "Failed to send the verification email for new user {UserId}",
                    user.Id),
                TaskContinuationOptions.OnlyOnFaulted);

        return user.Id;
    }
}
