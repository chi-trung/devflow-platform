using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.Register;

public sealed class RegisterCommandHandler(
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher) : IRequestHandler<RegisterCommand, Guid>
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

        return user.Id;
    }
}
