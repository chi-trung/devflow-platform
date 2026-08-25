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

        // The task belongs to the project but its current sprint is irrelevant —
        // "remove from sprint" means "back to backlog", no matter which sprint it
        // was in. Requiring task.SprintId == command.SprintId throws a 404 when
        // the client drops a task into the backlog after its sprintId changed
        // (stale sprint id in the UI state), which is a wrong outcome for a
        // perfectly valid drag-and-drop.
        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        task.RemoveFromSprint();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
