using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Projects.Create;

public sealed class CreateProjectCommandHandler(
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateProjectCommand, Guid>
{
    public async Task<Guid> Handle(CreateProjectCommand command, CancellationToken cancellationToken)
    {
        var key = command.Key.Trim().ToUpperInvariant();

        if (await projectRepository.KeyExistsInWorkspaceAsync(command.WorkspaceId, key, cancellationToken))
        {
            throw new ConflictException($"Key \"{key}\" is already used by another project in this workspace.");
        }

        var project = Project.Create(command.WorkspaceId, command.Name, key, command.Description, command.Emoji, command.CoverColor);

        await projectRepository.AddAsync(project, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return project.Id;
    }
}
