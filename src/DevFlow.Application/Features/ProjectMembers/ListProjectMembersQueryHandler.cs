using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

public sealed class ListProjectMembersQueryHandler(
    IProjectRepository projectRepository,
    IProjectMemberRepository projectMemberRepository,
    IUserRepository userRepository)
    : IRequestHandler<ListProjectMembersQuery, IReadOnlyList<ProjectMemberResponse>>
{
    public async Task<IReadOnlyList<ProjectMemberResponse>> Handle(
        ListProjectMembersQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken)
            ?? throw new NotFoundException(nameof(Project), query.ProjectId);

        if (project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var members = await projectMemberRepository.GetByProjectAsync(query.ProjectId, cancellationToken);

        if (members.Count == 0)
        {
            return [];
        }

        var userIds = members.Select(m => m.UserId);
        var users = await userRepository.GetByIdsAsync(userIds, cancellationToken);

        var result = members.Select(member =>
        {
            var user = users.GetValueOrDefault(member.UserId);
            return new ProjectMemberResponse(
                member.UserId,
                user?.Username ?? "unknown",
                user?.DisplayName ?? "Unknown",
                member.Role.ToString());
        }).ToList();

        return result;
    }
}