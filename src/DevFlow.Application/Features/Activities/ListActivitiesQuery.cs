using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Activities;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListActivitiesQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid? ActorUserId = null,
    Guid? TaskItemId = null,
    string? Action = null,
    DateTimeOffset? FromUtc = null,
    DateTimeOffset? ToUtc = null,
    int Take = 50,
    int Page = 1)
    : IRequest<ActivityResponsePage>, IWorkspaceRequest;

public sealed record ActivityResponsePage(
    IReadOnlyList<ActivityResponse> Items,
    int TotalCount,
    int Page,
    int PageSize);

public sealed record ActivityResponse(
    Guid Id,
    Guid? TaskItemId,
    string ActorName,
    string Action,
    string Target,
    DateTimeOffset CreatedAtUtc);
