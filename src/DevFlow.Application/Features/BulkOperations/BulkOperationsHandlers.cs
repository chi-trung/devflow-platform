using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Dependencies;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.BulkOperations;

// Bulk move tasks to status
// Cache-invalidation carriers: bulk ops write Status/AssigneeId/existence
// that the board's cached tasks payload and dashboard counts embed. Without
// IProjectEvent the 30s tasks:{projectId}:* cache keeps serving pre-bulk rows
// and the reload after a successful bulk call reverts the board.
// ActivityVerb stays empty → no per-task activity-log entries.
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record BulkMoveTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    List<Guid> TaskIds,
    TaskItemStatus NewStatus) : IRequest<int>, IWorkspaceRequest, IProjectEvent;

public class BulkMoveTasksHandler(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork,
    ITaskDependencyRepository dependencyRepository)
    : IRequestHandler<BulkMoveTasksCommand, int>
{
    public async Task<int> Handle(BulkMoveTasksCommand request, CancellationToken ct)
    {
        // Blocked-move enforcement: a bulk status change is rejected while any
        // selected task still has unresolved non-cyclic blockers. Foreign or
        // missing ids keep their existing silent skip (bulk is best-effort by
        // contract), but a task that would actually move is checked against
        // the project's edge set, loaded once for the whole batch. Because
        // the guard throws before SaveChanges, no partial bulk move commits.
        var blockedMoves = request.TaskIds.Count > 0
            ? await BlockedTaskMoves.EvaluateAsync(dependencyRepository, request.ProjectId, ct)
            : new BlockedTaskMoves.Evaluation(new Dictionary<Guid, IReadOnlyList<Guid>>(), new HashSet<Guid>());

        var count = 0;
        foreach (var taskId in request.TaskIds)
        {
            var task = await taskItemRepository.GetByIdAsync(taskId, ct);
            if (task != null && task.ProjectId == request.ProjectId)
            {
                if (task.Status != request.NewStatus)
                {
                    blockedMoves.ThrowIfBlocked(task.Id, task.Title);
                }

                task.ChangeStatus(request.NewStatus);
                count++;
            }
        }
        await unitOfWork.SaveChangesAsync(ct);
        return count;
    }
}

// Bulk assign tasks
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record BulkAssignTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    List<Guid> TaskIds,
    Guid? AssigneeId) : IRequest<int>, IWorkspaceRequest, IProjectEvent;

public class BulkAssignTasksHandler(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<BulkAssignTasksCommand, int>
{
    public async Task<int> Handle(BulkAssignTasksCommand request, CancellationToken ct)
    {
        var count = 0;
        foreach (var taskId in request.TaskIds)
        {
            var task = await taskItemRepository.GetByIdAsync(taskId, ct);
            if (task != null && task.ProjectId == request.ProjectId)
            {
                task.AssignTo(request.AssigneeId);
                count++;
            }
        }
        await unitOfWork.SaveChangesAsync(ct);
        return count;
    }
}

// Bulk delete tasks
[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record BulkDeleteTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    List<Guid> TaskIds) : IRequest<int>, IWorkspaceRequest, IProjectEvent;

public class BulkDeleteTasksHandler(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<BulkDeleteTasksCommand, int>
{
    public async Task<int> Handle(BulkDeleteTasksCommand request, CancellationToken ct)
    {
        var count = 0;
        foreach (var taskId in request.TaskIds)
        {
            var task = await taskItemRepository.GetByIdAsync(taskId, ct);
            if (task != null && task.ProjectId == request.ProjectId)
            {
                await taskItemRepository.RemoveAsync(task, ct);
                count++;
            }
        }
        await unitOfWork.SaveChangesAsync(ct);
        return count;
    }
}
