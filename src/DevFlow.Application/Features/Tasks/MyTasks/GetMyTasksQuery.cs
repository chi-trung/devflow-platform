using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.MyTasks;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetMyTasksQuery(
    Guid WorkspaceId,
    Guid UserId) : IRequest<IReadOnlyList<MyTaskItem>>, IWorkspaceRequest;

public sealed record MyTaskItem(
    Guid Id,
    Guid ProjectId,
    string ProjectName,
    string ProjectKey,
    string Title,
    string Status,
    string Priority,
    DateTimeOffset? DueDateUtc,
    DateTimeOffset? CompletedAtUtc,
    Guid? SprintId,
    string? SprintName);
