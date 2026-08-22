using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.BulkOperations;

// Bulk move tasks to status
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record BulkMoveTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    List<Guid> TaskIds,
    TaskItemStatus NewStatus) : IRequest<int>, IWorkspaceRequest;

public class BulkMoveTasksHandler(
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<BulkMoveTasksCommand, int>
{
    public async Task<int> Handle(BulkMoveTasksCommand request, CancellationToken ct)
    {
        var count = 0;
        foreach (var taskId in request.TaskIds)
        {
            var task = await taskItemRepository.GetByIdAsync(taskId, ct);
            if (task != null && task.ProjectId == request.ProjectId)
            {
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
    Guid? AssigneeId) : IRequest<int>, IWorkspaceRequest;

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
    List<Guid> TaskIds) : IRequest<int>, IWorkspaceRequest;

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
