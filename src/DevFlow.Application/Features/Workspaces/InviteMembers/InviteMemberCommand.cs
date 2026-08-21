using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.InviteMembers;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record InviteMemberCommand(
    Guid WorkspaceId,
    string Email,
    WorkspaceRole Role) : IRequest<MemberResponse>, IWorkspaceRequest;

public sealed record MemberResponse(Guid UserId, string Email, string Role);
