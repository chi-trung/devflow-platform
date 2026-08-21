using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListMembers;

public sealed class ListWorkspaceMembersQueryHandler(
    IWorkspaceRepository workspaceRepository,
    ICacheService cacheService)
    : IRequestHandler<ListWorkspaceMembersQuery, IReadOnlyList<WorkspaceMemberResponse>>
{
    public async Task<IReadOnlyList<WorkspaceMemberResponse>> Handle(
        ListWorkspaceMembersQuery query,
        CancellationToken cancellationToken)
    {
        string cacheKey = $"workspace-members:{query.WorkspaceId}";
        var cached = await cacheService.GetAsync<IReadOnlyList<WorkspaceMemberResponse>>(cacheKey, cancellationToken);
        if (cached is not null)
        {
            return cached;
        }

        var members = await workspaceRepository.GetMembersAsync(
            query.WorkspaceId, cancellationToken);

        var result = members.Select(member => new WorkspaceMemberResponse(
            member.UserId,
            member.Email,
            member.Username,
            member.DisplayName,
            member.Role.ToString())).ToList();

        await cacheService.SetAsync(cacheKey, result, TimeSpan.FromMinutes(2), cancellationToken);

        return result;
    }
}
