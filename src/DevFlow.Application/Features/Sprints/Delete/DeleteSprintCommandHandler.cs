using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Delete;

public sealed class DeleteSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteSprintCommand>
{
    public async Task Handle(DeleteSprintCommand command, CancellationToken cancellationToken)
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

        // Cascade: every task assigned to the deleted sprint returns to the
        // backlog. Tasks are loaded tracked so the SprintId=null change is
        // persisted alongside the delete.
        var sprintTasks = await taskItemRepository.GetForSprintAsync(sprint.Id, cancellationToken);

        foreach (var task in sprintTasks)
        {
            task.RemoveFromSprint();
        }

        await sprintRepository.RemoveAsync(sprint, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
