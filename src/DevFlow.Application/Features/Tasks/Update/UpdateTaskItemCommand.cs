using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string Title,
    string? Description,
    TaskItemStatus Status,
    TaskItemPriority Priority,
    Guid? AssigneeId,
    DateTimeOffset? DueDateUtc) : IRequest, IWorkspaceRequest, IProjectEvent;
