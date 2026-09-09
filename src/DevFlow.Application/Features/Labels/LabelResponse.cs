using DevFlow.Application.Common.Behaviors;
using MediatR;

namespace DevFlow.Application.Features.Labels;

public sealed record LabelResponse(
    Guid Id,
    string Name,
    string Color);

// Queries
public sealed record GetLabelsQuery(Guid ProjectId) : IRequest<IReadOnlyList<LabelResponse>>;

public sealed record GetLabelsForTaskQuery(Guid TaskItemId) : IRequest<IReadOnlyList<LabelResponse>>;

// Commands
public sealed record CreateLabelCommand(
    Guid ProjectId,
    string Name,
    string Color) : IRequest<LabelResponse>;

// Cache-invalidation carriers: these mutate TaskLabel rows that the board's
// tasks payload embeds (labelIds), so they implement IProjectEvent —
// CacheInvalidationBehavior then drops tasks:* and RealtimeBehavior wakes
// connected clients. ActivityVerb stays empty → no activity-log entry.
public sealed record DeleteLabelCommand(
    Guid ProjectId,
    Guid LabelId) : IRequest, IProjectEvent;

public sealed record AssignLabelToTaskCommand(
    Guid ProjectId,
    Guid TaskItemId,
    Guid LabelId) : IRequest, IProjectEvent;

public sealed record RemoveLabelFromTaskCommand(
    Guid ProjectId,
    Guid TaskItemId,
    Guid LabelId) : IRequest, IProjectEvent;
