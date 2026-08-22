using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.ChangePassword;

public sealed class ChangePasswordCommandHandler(
    IUserRepository userRepository,
    IUnitOfWork unitOfWork,
    IPasswordHasher passwordHasher) : IRequestHandler<ChangePasswordCommand>
{
    public async Task Handle(ChangePasswordCommand command, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken);

        if (user is null)
        {
            throw new NotFoundException(nameof(User), command.UserId);
        }

        // Verify current password
        if (!passwordHasher.Verify(command.CurrentPassword, user.PasswordHash))
        {
            throw new ForbiddenAccessException();
        }

        // Update to new password
        var newHash = passwordHasher.Hash(command.NewPassword);
        user.UpdatePasswordHash(newHash);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
