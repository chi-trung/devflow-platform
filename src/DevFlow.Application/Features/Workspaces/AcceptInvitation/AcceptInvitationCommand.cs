using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.AcceptInvitation;

// Authenticated only — the invitee is not a workspace member yet, so
// RequireWorkspaceRole would 403 them before the handler runs.
public sealed record AcceptInvitationCommand(Guid InvitationId) : IRequest<AcceptInvitationResponse>;

public sealed record AcceptInvitationResponse(
    Guid WorkspaceId,
    string WorkspaceName,
    string WorkspaceSlug,
    string Role);
