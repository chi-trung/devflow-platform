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

public sealed record DeleteLabelCommand(
    Guid ProjectId,
    Guid LabelId) : IRequest;

public sealed record AssignLabelToTaskCommand(
    Guid TaskItemId,
    Guid LabelId) : IRequest;

public sealed record RemoveLabelFromTaskCommand(
    Guid TaskItemId,
    Guid LabelId) : IRequest;
