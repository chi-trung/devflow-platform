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

        // Since the project was deleted, its key may have been taken by a live
        // project (the unique index is partial). Check before restoring — this
        // project's own row is still soft-deleted here, so the filtered query
        // naturally excludes it. Fail with 409 instead of a raw index violation.
        if (await projectRepository.KeyExistsInWorkspaceAsync(
                project.WorkspaceId, project.Key, cancellationToken))
        {
            throw new ConflictException(
                $"Key \"{project.Key}\" is now used by another project in this workspace.");
        }

        project.Restore();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
