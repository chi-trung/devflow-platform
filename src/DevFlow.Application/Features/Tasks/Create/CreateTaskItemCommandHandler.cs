using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Create;

public sealed class CreateTaskItemCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateTaskItemCommand, TaskItemCreatedResponse>
{
    public async Task<TaskItemCreatedResponse> Handle(
        CreateTaskItemCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = TaskItem.Create(
            command.ProjectId,
            command.Title,
            command.Description,
            command.Priority);

        await taskItemRepository.AddAsync(task, cancellationToken);

        var log = ActivityLog.Create(
            command.WorkspaceId,
            command.ProjectId,
            task.Id,
            userContext.UserId,
            "created task",
            task.Title);
        await activityLog.AddAsync(log, cancellationToken);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new TaskItemCreatedResponse(task.Id);
    }
}
