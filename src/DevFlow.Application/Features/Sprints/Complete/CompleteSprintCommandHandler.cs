using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Complete;

public sealed class CompleteSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CompleteSprintCommand>
{
    public async Task Handle(CompleteSprintCommand command, CancellationToken cancellationToken)
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

        sprint.Complete();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
