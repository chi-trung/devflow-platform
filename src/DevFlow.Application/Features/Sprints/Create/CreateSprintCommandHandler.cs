using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Create;

public sealed class CreateSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateSprintCommand, SprintResponse>
{
    public async Task<SprintResponse> Handle(CreateSprintCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var sprint = Sprint.Create(command.ProjectId, command.Name, command.Goal);

        await sprintRepository.AddAsync(sprint, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new SprintResponse(
            sprint.Id,
            sprint.ProjectId,
            sprint.Name,
            sprint.Goal,
            sprint.Status.ToString(),
            sprint.StartDateUtc,
            sprint.EndDateUtc,
            sprint.CompletedAtUtc);
    }
}
