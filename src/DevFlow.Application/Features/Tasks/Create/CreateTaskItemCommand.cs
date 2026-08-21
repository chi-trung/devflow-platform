using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Title,
    string? Description,
    TaskItemPriority Priority,
    DateTimeOffset? DueDateUtc) : IRequest<TaskItemCreatedResponse>, IWorkspaceRequest;

public sealed record TaskItemCreatedResponse(Guid Id);
