using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Exceptions;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.Delete;

public sealed class DeleteWorkspaceCommandHandler(
    IWorkspaceRepository workspaceRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<DeleteWorkspaceCommand>
{
    public async Task Handle(DeleteWorkspaceCommand request, CancellationToken cancellationToken)
    {
        var workspace = await workspaceRepository.GetByIdAsync(request.WorkspaceId, cancellationToken)
            ?? throw new NotFoundException(nameof(Domain.Entities.Workspace), request.WorkspaceId);

        workspaceRepository.Delete(workspace);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
