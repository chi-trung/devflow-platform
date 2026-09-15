using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Labels;

public sealed record LabelResponse(
    Guid Id,
    string Name,
    string Color);

// Every request carries WorkspaceId and implements IWorkspaceRequest so
// WorkspaceAuthorizationBehavior gates it on real workspace membership.
// Before this, the labels endpoints were only [Authorize] and the route's
// workspaceId was discarded: any authenticated user could read or mutate
// any project's labels by presenting that project's id. The handler still
// has to confirm the project lives in the claimed workspace — membership
// in workspace A proves nothing about a project id from workspace B.
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetLabelsQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<IReadOnlyList<LabelResponse>>, IWorkspaceRequest;

public sealed record GetLabelsForTaskQuery(Guid TaskItemId) : IRequest<IReadOnlyList<LabelResponse>>;

// Commands
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateLabelCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Name,
    string Color) : IRequest<LabelResponse>, IWorkspaceRequest;

// Cache-invalidation carriers: these mutate TaskLabel rows that the board's
// tasks payload embeds (labelIds), so they implement IProjectEvent —
// CacheInvalidationBehavior then drops tasks:* and RealtimeBehavior wakes
// connected clients. ActivityVerb stays empty → no activity-log entry.
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteLabelCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid LabelId) : IRequest, IWorkspaceRequest, IProjectEvent;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AssignLabelToTaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskItemId,
    Guid LabelId) : IRequest, IWorkspaceRequest, IProjectEvent;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record RemoveLabelFromTaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskItemId,
    Guid LabelId) : IRequest, IWorkspaceRequest, IProjectEvent;
