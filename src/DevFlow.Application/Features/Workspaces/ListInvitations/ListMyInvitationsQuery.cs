using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListInvitations;

public sealed record ListMyInvitationsQuery : IRequest<IReadOnlyList<InvitationSummary>>;

public sealed record InvitationSummary(
    Guid Id,
    Guid WorkspaceId,
    string WorkspaceName,
    string WorkspaceSlug,
    string InvitedEmail,
    string Role,
    string Status,
    DateTimeOffset InvitedAtUtc,
    string InvitedByName);
