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

// Get project-level dependency graph
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetProjectDependencyGraphQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<ProjectDependencyGraphResponse>, IWorkspaceRequest;

public class GetProjectDependencyGraphHandler(
    ITaskDependencyRepository dependencyRepository,
    ITaskItemRepository taskItemRepository)
    : IRequestHandler<GetProjectDependencyGraphQuery, ProjectDependencyGraphResponse>
{
    public async Task<ProjectDependencyGraphResponse> Handle(
        GetProjectDependencyGraphQuery request,
        CancellationToken cancellationToken)
    {
        var dependencies = await dependencyRepository.GetAllByProjectIdAsync(request.ProjectId, cancellationToken);
        var taskIds = dependencies
            .Select(d => d.BlockedTaskId)
            .Concat(dependencies.Select(d => d.BlockerTaskId))
            .Distinct()
            .ToList();

        var tasks = new Dictionary<Guid, Domain.Entities.TaskItem>();
        foreach (var taskId in taskIds)
        {
            var task = await taskItemRepository.GetByIdAsync(taskId, cancellationToken);
            if (task != null)
                tasks[taskId] = task;
        }

        var nodes = tasks.Values
            .OrderBy(t => t.Title)
            .Select(t => new TaskGraphNode(
                t.Id,
                t.Title,
                t.Status.ToString(),
                t.AssigneeId,
                t.ProjectId))
            .ToList();

        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in dependencies)
        {
            if (!adjacency.ContainsKey(dep.BlockedTaskId))
                adjacency[dep.BlockedTaskId] = new List<Guid>();
            adjacency[dep.BlockedTaskId].Add(dep.BlockerTaskId);
        }

        var visited = new HashSet<Guid>();
        var recursionStack = new HashSet<Guid>();
        var cyclicNodeIds = new HashSet<Guid>();
        var path = new List<Guid>();

        void Dfs(Guid node)
        {
            visited.Add(node);
            recursionStack.Add(node);
            path.Add(node);

            if (adjacency.TryGetValue(node, out var neighbors))
            {
                foreach (var neighbor in neighbors)
                {
                    if (!visited.Contains(neighbor))
                    {
                        Dfs(neighbor);
                    }
                    else if (recursionStack.Contains(neighbor))
                    {
                        var cycleStartIdx = path.IndexOf(neighbor);
                        for (var i = cycleStartIdx; i < path.Count; i++)
                        {
                            cyclicNodeIds.Add(path[i]);
                        }
                        cyclicNodeIds.Add(neighbor);
                    }
                }
            }

            path.Remove(node);
            recursionStack.Remove(node);
        }

        foreach (var nodeId in adjacency.Keys)
        {
            if (!visited.Contains(nodeId))
                Dfs(nodeId);
        }

        var edges = dependencies
            .Select(d => new DependencyGraphEdge(
                d.BlockedTaskId,
                d.BlockerTaskId,
                cyclicNodeIds.Contains(d.BlockedTaskId) && cyclicNodeIds.Contains(d.BlockerTaskId)))
            .ToList();

        return new ProjectDependencyGraphResponse(nodes, edges, cyclicNodeIds.ToList());
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

        if (await WouldCreateCycleAsync(request.TaskId, request.BlockerTaskId, cancellationToken))
            throw new ConflictException("Adding this dependency would create a circular dependency.");

        var dependency = Domain.Entities.TaskDependency.Create(request.TaskId, request.BlockerTaskId);
        await dependencyRepository.AddAsync(dependency, cancellationToken);

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

    private async Task<bool> WouldCreateCycleAsync(Guid blockedTaskId, Guid blockerTaskId, CancellationToken cancellationToken)
    {
        var allDeps = await dependencyRepository.GetAllByProjectIdAsync(
            await GetProjectIdAsync(blockedTaskId, cancellationToken),
            cancellationToken);

        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in allDeps)
        {
            if (!adjacency.ContainsKey(dep.BlockedTaskId))
                adjacency[dep.BlockedTaskId] = new List<Guid>();
            adjacency[dep.BlockedTaskId].Add(dep.BlockerTaskId);
        }

        var queue = new Queue<Guid>();
        var visited = new HashSet<Guid> { blockerTaskId };
        queue.Enqueue(blockerTaskId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (current == blockedTaskId)
                return true;

            if (adjacency.TryGetValue(current, out var neighbors))
            {
                foreach (var neighbor in neighbors)
                {
                    if (visited.Add(neighbor))
                        queue.Enqueue(neighbor);
                }
            }
        }

        return false;
    }

    private async Task<Guid> GetProjectIdAsync(Guid taskId, CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(taskId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.TaskItem), taskId);
        return task.ProjectId;
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
