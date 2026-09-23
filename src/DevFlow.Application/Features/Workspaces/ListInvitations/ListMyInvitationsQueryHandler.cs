using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListInvitations;

public sealed class ListMyInvitationsQueryHandler(
    IWorkspaceInvitationRepository invitationRepository,
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    IUserContext userContext) : IRequestHandler<ListMyInvitationsQuery, IReadOnlyList<InvitationSummary>>
{
    public async Task<IReadOnlyList<InvitationSummary>> Handle(
        ListMyInvitationsQuery request,
        CancellationToken cancellationToken)
    {
        var invitations = await invitationRepository.ListPendingForUserAsync(
            userContext.UserId, cancellationToken);

        var result = new List<InvitationSummary>(invitations.Count);
        foreach (var invitation in invitations)
        {
            var workspace = await workspaceRepository.GetByIdAsync(invitation.WorkspaceId, cancellationToken);
            if (workspace is null)
            {
                continue;
            }

            var inviter = await userRepository.GetByIdAsync(invitation.InvitedByUserId, cancellationToken);
            result.Add(new InvitationSummary(
                invitation.Id,
                invitation.WorkspaceId,
                workspace.Name,
                workspace.Slug,
                invitation.InvitedEmail,
                invitation.Role.ToString(),
                invitation.Status.ToString(),
                invitation.InvitedAtUtc,
                inviter?.DisplayName ?? "Someone"));
        }

        return result;
    }
}
