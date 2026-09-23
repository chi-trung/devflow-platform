using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListInvitations;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record ListWorkspacePendingInvitationsQuery(Guid WorkspaceId)
    : IRequest<IReadOnlyList<PendingInvitationSummary>>, IWorkspaceRequest;

public sealed record PendingInvitationSummary(
    Guid Id,
    Guid WorkspaceId,
    Guid InvitedUserId,
    string InvitedEmail,
    string Role,
    string Status,
    DateTimeOffset InvitedAtUtc,
    string InvitedByName,
    string InviteeDisplayName);
