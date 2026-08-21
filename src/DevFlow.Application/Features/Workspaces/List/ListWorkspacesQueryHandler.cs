using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.List;

public sealed class ListWorkspacesQueryHandler(
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext) : IRequestHandler<ListWorkspacesQuery, IReadOnlyList<WorkspaceResponse>>
{
    public async Task<IReadOnlyList<WorkspaceResponse>> Handle(
        ListWorkspacesQuery query,
        CancellationToken cancellationToken)
    {
        var memberships = await workspaceRepository.GetForUserAsync(userContext.UserId, cancellationToken);

        return memberships
            .Select(membership => new WorkspaceResponse(
                membership.Workspace.Id,
                membership.Workspace.Name,
                membership.Workspace.Slug,
                membership.Workspace.Description,
                membership.Role.ToString()))
            .ToList();
    }
}
