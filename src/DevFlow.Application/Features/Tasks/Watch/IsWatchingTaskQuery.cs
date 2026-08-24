using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Watch;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record IsWatchingTaskQuery(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest<bool>, IWorkspaceRequest;

public sealed class IsWatchingTaskQueryHandler(
    ITaskItemRepository taskItemRepository,
    ITaskWatcherRepository watcherRepository,
    IUserContext userContext) : IRequestHandler<IsWatchingTaskQuery, bool>
{
    public async Task<bool> Handle(IsWatchingTaskQuery query, CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(query.TaskId, cancellationToken);

        if (task is null || task.ProjectId != query.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), query.TaskId);
        }

        return await watcherRepository.ExistsAsync(
            query.TaskId, userContext.UserId, cancellationToken);
    }
}
