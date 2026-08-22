using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.UpdateProfile;

public sealed class UpdateProfileCommandHandler(
    IUserRepository userRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateProfileCommand>
{
    public async Task Handle(UpdateProfileCommand command, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken);

        if (user is null)
        {
            throw new NotFoundException(nameof(User), command.UserId);
        }

        // Check username uniqueness (excluding current user)
        if (await userRepository.ExistsByUsernameExceptIdAsync(command.Username, command.UserId, cancellationToken))
        {
            throw new ConflictException($"Username \"{command.Username}\" is already taken.");
        }

        user.UpdateProfile(command.DisplayName, command.Username);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
