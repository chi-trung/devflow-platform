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
        if (await userRepository.ExistsByUsernameAsync(command.Username, cancellationToken))
        {
            throw new ConflictException($"Username \"{command.Username}\" is already taken.");
        }

        // No address is collected, so there is nothing to verify and nothing to
        // email. That is the point: collecting one let anyone claim an inbox
        // that belonged to somebody else, and the only remedy was an emailed
        // link — which needs a mail provider the free deployment tiers cannot
        // run. The dashboard instead prompts the account to link a Google or
        // GitHub identity, which is recoverable without any mail at all.
        var user = User.CreateWithPassword(
            command.Username,
            passwordHasher.Hash(command.Password),
            command.DisplayName);

        await userRepository.AddAsync(user, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return user.Id;
    }
}
