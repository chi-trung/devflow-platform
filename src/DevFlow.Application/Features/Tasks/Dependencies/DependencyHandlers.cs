using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Dependencies;

// Get dependencies for a task
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskDependenciesQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<List<TaskDependencyResponse>>, IWorkspaceRequest;

public class GetTaskDependenciesHandler(
    ITaskDependencyRepository dependencyRepository,
    ITaskItemRepository taskItemRepository)
    : IRequestHandler<GetTaskDependenciesQuery, List<TaskDependencyResponse>>
{
    public async Task<List<TaskDependencyResponse>> Handle(
        GetTaskDependenciesQuery request,
        CancellationToken cancellationToken)
    {
        var dependencies = await dependencyRepository.GetByTaskIdAsync(request.TaskId, cancellationToken);
        var result = new List<TaskDependencyResponse>();

        foreach (var dep in dependencies)
        {
            var blockerTask = await taskItemRepository.GetByIdAsync(dep.BlockerTaskId, cancellationToken);
            if (blockerTask != null)
            {
                result.Add(new TaskDependencyResponse(
                    dep.Id,
                    dep.BlockedTaskId,
                    dep.BlockerTaskId,
                    blockerTask.Title,
                    blockerTask.Status.ToString(),
                    blockerTask.Status == TaskItemStatus.Done));
            }
        }

        return result;
    }
}

// Add dependency (blocker)
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AddTaskDependencyCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid BlockerTaskId) : IRequest, IWorkspaceRequest;

public class AddTaskDependencyHandler(
    ITaskDependencyRepository dependencyRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AddTaskDependencyCommand>
{
    public async Task Handle(
        AddTaskDependencyCommand request,
        CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(request.TaskId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.TaskId);

        if (task.ProjectId != request.ProjectId)
            throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.TaskId);

        var blocker = await taskItemRepository.GetByIdAsync(request.BlockerTaskId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.BlockerTaskId);

        if (blocker.ProjectId != request.ProjectId)
            throw new NotFoundException(nameof(Domain.Entities.TaskItem), request.BlockerTaskId);

        var exists = await dependencyRepository.ExistsAsync(request.TaskId, request.BlockerTaskId, cancellationToken);
        if (exists)
            throw new ConflictException("This dependency already exists.");

        var dependency = Domain.Entities.TaskDependency.Create(request.TaskId, request.BlockerTaskId);
        await dependencyRepository.AddAsync(dependency, cancellationToken);

        // Log activity
        var log = Domain.Entities.ActivityLog.Create(
            request.WorkspaceId,
            request.ProjectId,
            request.TaskId,
            userContext.UserId,
            "added a dependency on",
            blocker.Title);
        await activityLog.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

// Remove dependency
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record RemoveTaskDependencyCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    Guid DependencyId) : IRequest, IWorkspaceRequest;

public class RemoveTaskDependencyHandler(
    ITaskDependencyRepository dependencyRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork)
    : IRequestHandler<RemoveTaskDependencyCommand>
{
    public async Task Handle(
        RemoveTaskDependencyCommand request,
        CancellationToken cancellationToken)
    {
        var dependency = await dependencyRepository.GetByIdAsync(request.DependencyId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskDependency), request.DependencyId);

        if (dependency.BlockedTaskId != request.TaskId)
            throw new NotFoundException(nameof(Domain.Entities.TaskDependency), request.DependencyId);

        var task = await taskItemRepository.GetByIdAsync(request.TaskId, cancellationToken);
        dependencyRepository.Remove(dependency);

        // Log activity
        if (task is not null)
        {
            var log = Domain.Entities.ActivityLog.Create(
                request.WorkspaceId,
                request.ProjectId,
                request.TaskId,
                userContext.UserId,
                "removed a dependency from",
                task.Title);
            await activityLog.AddAsync(log, cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
