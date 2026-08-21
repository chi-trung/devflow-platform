using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Create;

public sealed class CreateWorkspaceCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUnitOfWork unitOfWork,
    IUserContext userContext) : IRequestHandler<CreateWorkspaceCommand, Guid>
{
    public async Task<Guid> Handle(CreateWorkspaceCommand command, CancellationToken cancellationToken)
    {
        if (await workspaceRepository.ExistsBySlugAsync(command.Slug, cancellationToken))
        {
            throw new ConflictException($"Slug \"{command.Slug}\" is already taken.");
        }

        var workspace = Workspace.Create(command.Name, command.Slug, command.Description);
        workspace.AddMember(userContext.UserId, WorkspaceRole.Owner);

        await workspaceRepository.AddAsync(workspace, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return workspace.Id;
    }
}
