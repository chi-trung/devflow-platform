using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.List;

public sealed class ListWorkspacesQueryHandler(
    IWorkspaceRepository workspaceRepository,
    IUserContext userContext) : IRequestHandler<ListWorkspacesQuery, PagedResult<WorkspaceResponse>>
{
    public async Task<PagedResult<WorkspaceResponse>> Handle(
        ListWorkspacesQuery query,
        CancellationToken cancellationToken)
    {
        var memberships = await workspaceRepository.GetForUserAsync(userContext.UserId, cancellationToken);

        // Clamp page values
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var totalCount = memberships.Count;
        var skip = (page - 1) * pageSize;

        var items = memberships
            .Skip(skip)
            .Take(pageSize)
            .Select(membership => new WorkspaceResponse(
                membership.Workspace.Id,
                membership.Workspace.Name,
                membership.Workspace.Slug,
                membership.Workspace.Description,
                membership.Role.ToString(),
                membership.Workspace.Emoji))
            .ToList();

        return new PagedResult<WorkspaceResponse>(items, totalCount, page, pageSize);
    }
}
