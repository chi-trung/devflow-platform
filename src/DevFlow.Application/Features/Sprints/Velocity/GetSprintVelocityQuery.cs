using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Velocity;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetSprintVelocityQuery(Guid WorkspaceId, Guid ProjectId, Guid SprintId)
    : IRequest<SprintVelocityResponse>, IWorkspaceRequest;
