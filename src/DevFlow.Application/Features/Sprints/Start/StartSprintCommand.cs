using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Start;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record StartSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId,
    DateTimeOffset StartDateUtc,
    DateTimeOffset EndDateUtc) : IRequest, IWorkspaceRequest, IProjectEvent;
