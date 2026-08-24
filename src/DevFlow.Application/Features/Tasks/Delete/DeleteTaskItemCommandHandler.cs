using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Delete;

public sealed class DeleteTaskItemCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteTaskItemCommand>
{
    public async Task Handle(DeleteTaskItemCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        await taskItemRepository.RemoveAsync(task, cancellationToken);

        var log = ActivityLog.Create(
            command.WorkspaceId,
            command.ProjectId,
            task.Id,
            userContext.UserId,
            "deleted task",
            task.Title);
        await activityLog.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
