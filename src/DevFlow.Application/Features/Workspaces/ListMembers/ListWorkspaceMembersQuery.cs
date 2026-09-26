using DevFlow.Application.Common.Authorization;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListMembers;

public sealed record ListWorkspaceMembersQuery(Guid WorkspaceId)
    : IRequest<IReadOnlyList<WorkspaceMemberResponse>>, IWorkspaceRequest;

/// <param name="Email">Null for a member who never linked a provider.</param>
public sealed record WorkspaceMemberResponse(
    Guid UserId,
    string? Email,
    string Username,
    string DisplayName,
    string Role);
