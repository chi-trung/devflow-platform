using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Complete;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record CompleteSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId) : IRequest, IWorkspaceRequest;
