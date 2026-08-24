using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

public sealed class DetachSubtaskCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DetachSubtaskCommand>
{
    public async Task Handle(DetachSubtaskCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var parent = await taskItemRepository.GetByIdAsync(command.ParentTaskId, cancellationToken);

        if (parent is null || parent.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.ParentTaskId);
        }

        var subtask = await taskItemRepository.GetByIdAsync(command.SubtaskId, cancellationToken);

        if (subtask is null || subtask.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.SubtaskId);
        }

        if (subtask.ParentTaskId != parent.Id)
        {
            throw new ConflictException("Task is not a subtask of the given parent task.");
        }

        subtask.DetachFromParent();

        var log = ActivityLog.Create(
            command.WorkspaceId,
            command.ProjectId,
            parent.Id,
            userContext.UserId,
            "removed subtask",
            subtask.Title);
        await activityLog.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
