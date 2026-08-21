using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.AssignTask;

public sealed class AssignTaskToSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AssignTaskToSprintCommand>
{
    public async Task Handle(AssignTaskToSprintCommand command, CancellationToken cancellationToken)
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

        if (sprint.Status == SprintStatus.Completed)
        {
            throw new ConflictException("Tasks cannot be added to a completed sprint.");
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        task.AssignToSprint(sprint.Id);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
