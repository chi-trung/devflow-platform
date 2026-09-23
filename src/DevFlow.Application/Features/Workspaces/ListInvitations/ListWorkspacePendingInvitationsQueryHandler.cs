using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListInvitations;

public sealed class ListWorkspacePendingInvitationsQueryHandler(
    IWorkspaceInvitationRepository invitationRepository,
    IUserRepository userRepository) : IRequestHandler<ListWorkspacePendingInvitationsQuery, IReadOnlyList<PendingInvitationSummary>>
{
    public async Task<IReadOnlyList<PendingInvitationSummary>> Handle(
        ListWorkspacePendingInvitationsQuery request,
        CancellationToken cancellationToken)
    {
        var invitations = await invitationRepository.ListPendingForWorkspaceAsync(
            request.WorkspaceId, cancellationToken);

        var result = new List<PendingInvitationSummary>(invitations.Count);
        foreach (var invitation in invitations)
        {
            var inviter = await userRepository.GetByIdAsync(invitation.InvitedByUserId, cancellationToken);
            var invitee = await userRepository.GetByIdAsync(invitation.InvitedUserId, cancellationToken);
            result.Add(new PendingInvitationSummary(
                invitation.Id,
                invitation.WorkspaceId,
                invitation.InvitedUserId,
                invitation.InvitedEmail,
                invitation.Role.ToString(),
                invitation.Status.ToString(),
                invitation.InvitedAtUtc,
                inviter?.DisplayName ?? "Someone",
                invitee?.DisplayName ?? invitee?.Username ?? invitation.InvitedEmail));
        }

        return result;
    }
}
