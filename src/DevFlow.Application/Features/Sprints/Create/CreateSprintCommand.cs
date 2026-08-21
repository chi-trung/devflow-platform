using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Create;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CreateSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Name,
    string? Goal) : IRequest<SprintResponse>, IWorkspaceRequest;
