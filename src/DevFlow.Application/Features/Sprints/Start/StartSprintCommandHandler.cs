using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Start;

public sealed class StartSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<StartSprintCommand>
{
    public async Task Handle(StartSprintCommand command, CancellationToken cancellationToken)
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

        if (await sprintRepository.HasActiveSprintAsync(command.ProjectId, cancellationToken))
        {
            throw new ConflictException("This project already has an active sprint. Complete it first.");
        }

        sprint.Start(command.StartDateUtc, command.EndDateUtc);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
