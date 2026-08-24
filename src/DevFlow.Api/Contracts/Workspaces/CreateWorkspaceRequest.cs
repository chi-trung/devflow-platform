using DevFlow.Domain.Enums;

namespace DevFlow.Api.Contracts.Workspaces;

public sealed record CreateWorkspaceRequest(
    string Name,
    string Slug,
    string? Description);

public sealed record WorkspaceCreatedResponse(Guid Id);
public sealed record UpdateWorkspaceRequest(string Name, string? Description);
public sealed record InviteMemberRequest(string Email, WorkspaceRole Role);
public sealed record UpdateMemberRoleRequest(WorkspaceRole Role);
