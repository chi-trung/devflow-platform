using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Activities;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListActivitiesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<ActivityResponse>>, IWorkspaceRequest;

public sealed record ActivityResponse(
    Guid Id,
    Guid? TaskItemId,
    string ActorName,
    string Action,
    string Target,
    DateTimeOffset CreatedAtUtc);
