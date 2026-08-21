namespace DevFlow.Api.Contracts.Workspaces;

public sealed record CreateWorkspaceRequest(
    string Name,
    string Slug,
    string? Description);

public sealed record WorkspaceCreatedResponse(Guid Id);
