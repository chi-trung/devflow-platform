using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Dependencies;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record RemoveEpicDependencyCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId,
    Guid BlockedByEpicId) : IRequest, IWorkspaceRequest;

public sealed class RemoveEpicDependencyCommandHandler(
    IEpicRepository epicRepository,
    IEpicDependencyRepository dependencyRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<RemoveEpicDependencyCommand>
{
    public async Task Handle(RemoveEpicDependencyCommand command, CancellationToken cancellationToken)
    {
        var epic = await epicRepository.GetByIdAsync(command.EpicId, cancellationToken);
        if (epic is null || epic.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), command.EpicId);
        }

        await dependencyRepository.RemoveAsync(command.EpicId, command.BlockedByEpicId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}