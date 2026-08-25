using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Epics.Dependencies;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AddEpicDependencyCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId,
    Guid BlockedByEpicId) : IRequest, IWorkspaceRequest;

public sealed class AddEpicDependencyCommandHandler(
    IEpicRepository epicRepository,
    IEpicDependencyRepository dependencyRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<AddEpicDependencyCommand>
{
    public async Task Handle(AddEpicDependencyCommand command, CancellationToken cancellationToken)
    {
        var epic = await epicRepository.GetByIdAsync(command.EpicId, cancellationToken);
        if (epic is null || epic.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), command.EpicId);
        }

        var blocker = await epicRepository.GetByIdAsync(command.BlockedByEpicId, cancellationToken);
        if (blocker is null || blocker.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), command.BlockedByEpicId);
        }

        var dependency = EpicDependency.Create(command.EpicId, command.BlockedByEpicId);
        await dependencyRepository.AddAsync(dependency, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}