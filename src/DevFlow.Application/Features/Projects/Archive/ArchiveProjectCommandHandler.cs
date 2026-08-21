using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Projects.Archive;

public sealed class ArchiveProjectCommandHandler(
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<ArchiveProjectCommand>
{
    public async Task Handle(ArchiveProjectCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Domain.Entities.Project), command.ProjectId);
        }

        project.Archive();
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
