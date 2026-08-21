using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.ListMembers;

public sealed class ListWorkspaceMembersQueryHandler(
    IWorkspaceRepository workspaceRepository)
    : IRequestHandler<ListWorkspaceMembersQuery, IReadOnlyList<WorkspaceMemberResponse>>
{
    public async Task<IReadOnlyList<WorkspaceMemberResponse>> Handle(
        ListWorkspaceMembersQuery query,
        CancellationToken cancellationToken)
    {
        var members = await workspaceRepository.GetMembersAsync(
            query.WorkspaceId, cancellationToken);

        return members.Select(member => new WorkspaceMemberResponse(
            member.UserId,
            member.Email,
            member.Username,
            member.DisplayName,
            member.Role.ToString())).ToList();
    }
}
