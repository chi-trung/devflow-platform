using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListProjectMembersQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<ProjectMemberResponse>>, IWorkspaceRequest;
