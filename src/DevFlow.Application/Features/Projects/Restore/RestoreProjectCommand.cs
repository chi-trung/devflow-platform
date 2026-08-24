using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Projects.Restore;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record RestoreProjectCommand(Guid WorkspaceId, Guid ProjectId) : IRequest, IWorkspaceRequest;

public sealed class RestoreProjectCommandHandler(
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RestoreProjectCommand>
{
    public async Task Handle(RestoreProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdIncludingDeletedAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Domain.Entities.Project), command.ProjectId);
        }

        project.Restore();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
