using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListSubtasksQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid ParentTaskId) : IRequest<IReadOnlyList<TaskItemResponse>>, IWorkspaceRequest;
