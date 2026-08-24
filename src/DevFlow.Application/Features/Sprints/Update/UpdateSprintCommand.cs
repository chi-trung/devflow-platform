using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Sprints.Update;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateSprintCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid SprintId,
    string Name,
    string? Goal) : IRequest<SprintResponse>, IWorkspaceRequest;

public sealed class UpdateSprintCommandHandler(
    IProjectRepository projectRepository,
    ISprintRepository sprintRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateSprintCommand, SprintResponse>
{
    public async Task<SprintResponse> Handle(
        UpdateSprintCommand command,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(command.Name))
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Name"] = ["Sprint name is required."],
            });
        }

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

        sprint.UpdateDetails(command.Name, command.Goal);
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
