using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Watch;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record WatchTaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest, IWorkspaceRequest;

public sealed class WatchTaskCommandHandler(
    ITaskItemRepository taskItemRepository,
    ITaskWatcherRepository watcherRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<WatchTaskCommand>
{
    public async Task Handle(WatchTaskCommand command, CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        var alreadyWatching = await watcherRepository.ExistsAsync(
            command.TaskId, userContext.UserId, cancellationToken);

        if (alreadyWatching)
        {
            return;
        }

        await watcherRepository.AddAsync(
            TaskWatcher.Create(command.TaskId, userContext.UserId),
            cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
