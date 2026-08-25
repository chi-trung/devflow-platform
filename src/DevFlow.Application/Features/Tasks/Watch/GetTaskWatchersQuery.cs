using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Watch;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetTaskWatchersQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<IReadOnlyList<TaskWatcherResponse>>, IWorkspaceRequest;

public sealed record TaskWatcherResponse(
    Guid UserId,
    string Username,
    string DisplayName);

public sealed class GetTaskWatchersQueryHandler(
    ITaskItemRepository taskItemRepository,
    ITaskWatcherRepository watcherRepository,
    IUserRepository userRepository) : IRequestHandler<GetTaskWatchersQuery, IReadOnlyList<TaskWatcherResponse>>
{
    public async Task<IReadOnlyList<TaskWatcherResponse>> Handle(
        GetTaskWatchersQuery query,
        CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(query.TaskId, cancellationToken);

        if (task is null || task.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.TaskId);
        }

        var watchers = await watcherRepository.GetByTaskAsync(query.TaskId, cancellationToken);

        if (watchers.Count == 0)
        {
            return [];
        }

        var userIds = watchers.Select(w => w.UserId).ToArray();
        var names = await userRepository.GetDisplayNamesAsync(userIds, cancellationToken);

        return watchers
            .Select(w => new TaskWatcherResponse(
                w.UserId,
                names.GetValueOrDefault(w.UserId, "user"),
                names.GetValueOrDefault(w.UserId, "User")))
            .ToList();
    }
}
