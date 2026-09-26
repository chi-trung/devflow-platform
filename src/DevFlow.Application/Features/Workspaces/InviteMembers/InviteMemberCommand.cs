using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.InviteMembers;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record InviteMemberCommand(
    Guid WorkspaceId,
    string Email,
    WorkspaceRole Role) : IRequest<MemberResponse>, IWorkspaceRequest;

/// <param name="Email">Null for a member who never linked a provider.</param>
public sealed record MemberResponse(Guid UserId, string? Email, string Role);
