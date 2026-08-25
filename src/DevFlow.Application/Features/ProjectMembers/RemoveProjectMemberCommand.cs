using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.ProjectMembers;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
[RequireProjectRole(ProjectRole.Manager)]
public sealed record RemoveProjectMemberCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid UserId) : IRequest, IProjectRequest;
