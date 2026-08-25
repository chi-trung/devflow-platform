using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
[RequireProjectRole(ProjectRole.Manager)]
public sealed record UpdateProjectMemberRoleCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid UserId,
    ProjectRole Role) : IRequest, IProjectRequest;
