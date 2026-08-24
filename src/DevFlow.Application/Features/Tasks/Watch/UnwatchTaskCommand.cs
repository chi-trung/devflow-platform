using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Watch;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UnwatchTaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId) : IRequest, IWorkspaceRequest;

public sealed class UnwatchTaskCommandHandler(
    ITaskItemRepository taskItemRepository,
    ITaskWatcherRepository watcherRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<UnwatchTaskCommand>
{
    public async Task Handle(UnwatchTaskCommand command, CancellationToken cancellationToken)
    {
        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        await watcherRepository.RemoveAsync(
            command.TaskId, userContext.UserId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
