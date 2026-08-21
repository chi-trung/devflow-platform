using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.InviteMembers;

public sealed class InviteMemberCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    ICacheService cacheService,
    IUnitOfWork unitOfWork) : IRequestHandler<InviteMemberCommand, MemberResponse>
{
    public async Task<MemberResponse> Handle(InviteMemberCommand command, CancellationToken cancellationToken)
    {
        var email = command.Email.Trim().ToLowerInvariant();

        var user = await userRepository.GetByEmailAsync(email, cancellationToken)
            ?? throw new NotFoundException(nameof(User), email);

        var existingRole = await workspaceRepository.GetMemberRoleAsync(
            command.WorkspaceId, user.Id, cancellationToken);

        if (existingRole is not null)
        {
            throw new ConflictException($"User \"{email}\" is already a member of this workspace.");
        }

        var workspace = await workspaceRepository.GetByIdAsync(command.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Workspace), command.WorkspaceId);

        await workspaceRepository.AddMemberAsync(workspace, user.Id, command.Role, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        await cacheService.RemoveAsync($"workspace-members:{command.WorkspaceId}", cancellationToken);

        return new MemberResponse(user.Id, user.Email, command.Role.ToString());
    }
}
