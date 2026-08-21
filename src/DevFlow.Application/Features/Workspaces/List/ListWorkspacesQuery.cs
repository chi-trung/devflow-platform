using MediatR;

namespace DevFlow.Application.Features.Workspaces.List;

public sealed record WorkspaceResponse(
    Guid Id,
    string Name,
    string Slug,
    string? Description,
    string Role);

public sealed record ListWorkspacesQuery : IRequest<IReadOnlyList<WorkspaceResponse>>;
