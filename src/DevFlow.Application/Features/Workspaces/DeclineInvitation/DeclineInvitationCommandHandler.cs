using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.DeclineInvitation;

public sealed class DeclineInvitationCommandHandler(
    IWorkspaceInvitationRepository invitationRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DeclineInvitationCommand>
{
    public async Task Handle(DeclineInvitationCommand command, CancellationToken cancellationToken)
    {
        var invitation = await invitationRepository.GetByIdAsync(command.InvitationId, cancellationToken)
            ?? throw new NotFoundException("WorkspaceInvitation", command.InvitationId);

        if (invitation.InvitedUserId != userContext.UserId)
        {
            throw new NotFoundException("WorkspaceInvitation", command.InvitationId);
        }

        if (invitation.Status != InvitationStatus.Pending)
        {
            throw new ConflictException($"This invitation is {invitation.Status}.");
        }

        invitation.Decline();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
