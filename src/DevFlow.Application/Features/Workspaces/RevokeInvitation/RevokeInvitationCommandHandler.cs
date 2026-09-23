using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.RevokeInvitation;

public sealed class RevokeInvitationCommandHandler(
    IWorkspaceInvitationRepository invitationRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RevokeInvitationCommand>
{
    public async Task Handle(RevokeInvitationCommand command, CancellationToken cancellationToken)
    {
        var invitation = await invitationRepository.GetByIdAsync(command.InvitationId, cancellationToken)
            ?? throw new NotFoundException("WorkspaceInvitation", command.InvitationId);

        if (invitation.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException("WorkspaceInvitation", command.InvitationId);
        }

        if (invitation.Status != InvitationStatus.Pending)
        {
            throw new ConflictException($"This invitation is {invitation.Status}.");
        }

        invitation.Revoke();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
