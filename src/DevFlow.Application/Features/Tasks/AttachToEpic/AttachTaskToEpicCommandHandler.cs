using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.AttachToEpic;

public sealed class AttachTaskToEpicCommandHandler(
    IProjectRepository projectRepository,
    IEpicRepository epicRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AttachTaskToEpicCommand>
{
    public async Task Handle(AttachTaskToEpicCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var epic = await epicRepository.GetByIdAsync(command.EpicId, cancellationToken);

        // An epic from another project would silently poison the task's
        // EpicId with an id no board in this project can render.
        if (epic is null || epic.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), command.EpicId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        task.AttachToEpic(epic.Id);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
