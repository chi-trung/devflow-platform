using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Estimation;

public sealed class SetTaskEstimationCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<SetTaskEstimationCommand>
{
    // Fibonacci sequence used by planning poker; null clears the estimate.
    public static readonly IReadOnlyList<int> AllowedStoryPoints = [1, 2, 3, 5, 8, 13, 21];

    public async Task Handle(SetTaskEstimationCommand command, CancellationToken cancellationToken)
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

        task.SetStoryPoints(command.StoryPoints);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
