using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.AcceptInvitation;

public sealed class AcceptInvitationCommandHandler(
    IWorkspaceInvitationRepository invitationRepository,
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext,
    ICacheService cacheService,
    IUnitOfWork unitOfWork) : IRequestHandler<AcceptInvitationCommand, AcceptInvitationResponse>
{
    public async Task<AcceptInvitationResponse> Handle(
        AcceptInvitationCommand command,
        CancellationToken cancellationToken)
    {
        var invitation = await invitationRepository.GetByIdAsync(command.InvitationId, cancellationToken)
            ?? throw new NotFoundException("WorkspaceInvitation", command.InvitationId);

        if (invitation.InvitedUserId != userContext.UserId)
        {
            // Do not leak other users' invitations.
            throw new NotFoundException("WorkspaceInvitation", command.InvitationId);
        }

        if (invitation.Status != Domain.Enums.InvitationStatus.Pending)
        {
            throw new ConflictException($"This invitation is {invitation.Status}.");
        }

        var existingRole = await workspaceRepository.GetMemberRoleAsync(
            invitation.WorkspaceId, userContext.UserId, cancellationToken);

        if (existingRole is not null)
        {
            // Already a member (e.g. invited twice / race): mark accepted, don't double-add.
            invitation.Accept();
            await unitOfWork.SaveChangesAsync(cancellationToken);
            var existingWorkspace = await workspaceRepository.GetByIdAsync(invitation.WorkspaceId, cancellationToken)
                ?? throw new NotFoundException(nameof(Domain.Entities.Workspace), invitation.WorkspaceId);
            return new AcceptInvitationResponse(
                invitation.WorkspaceId,
                existingWorkspace.Name,
                existingWorkspace.Slug,
                existingRole.Value.ToString());
        }

        var workspace = await workspaceRepository.GetByIdAsync(invitation.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Workspace), invitation.WorkspaceId);

        invitation.Accept();
        await workspaceRepository.AddMemberAsync(workspace, userContext.UserId, invitation.Role, cancellationToken);
        await cacheService.RemoveAsync($"workspace-members:{invitation.WorkspaceId}", cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // invitation.WorkspaceId is the source of truth for which workspace
        // was joined — workspace.Id is only the loaded entity's local id.
        return new AcceptInvitationResponse(
            invitation.WorkspaceId,
            workspace.Name,
            workspace.Slug,
            invitation.Role.ToString());
    }
}
