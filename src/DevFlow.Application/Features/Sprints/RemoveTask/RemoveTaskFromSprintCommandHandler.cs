using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.RemoveTask;

public sealed class RemoveTaskFromSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveTaskFromSprintCommand>
{
    public async Task Handle(RemoveTaskFromSprintCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var sprint = await sprintRepository.GetByIdAsync(command.SprintId, cancellationToken);

        if (sprint is null || sprint.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Sprint), command.SprintId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId || task.SprintId != command.SprintId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        task.RemoveFromSprint();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
