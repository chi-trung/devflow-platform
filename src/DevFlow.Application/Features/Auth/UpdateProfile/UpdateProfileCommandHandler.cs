using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Auth.UpdateProfile;

public sealed class UpdateProfileCommandHandler(
    IUserRepository userRepository,
    IWorkspaceRepository workspaceRepository,
    ICacheService cacheService,
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

        // Member rosters embed each member's username/displayName and are
        // cached per workspace under an untagged key (2-min TTL) that only
        // the invite/remove/role handlers drop. A rename used to stay
        // invisible to assignee pickers and member lists until the TTL
        // expired — mirror their RemoveAsync for every workspace the user
        // belongs to.
        var memberships = await workspaceRepository.GetForUserAsync(command.UserId, cancellationToken);

        foreach (var (workspace, _) in memberships)
        {
            await cacheService.RemoveAsync($"workspace-members:{workspace.Id}", cancellationToken);
        }
    }
}
