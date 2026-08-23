using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Epics.Delete;

public sealed class DeleteEpicCommandHandler(
    IProjectRepository projectRepository,
    IEpicRepository epicRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteEpicCommand>
{
    public async Task Handle(DeleteEpicCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var epic = await epicRepository.GetByIdAsync(command.EpicId, cancellationToken);

        if (epic is null || epic.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(Epic), command.EpicId);
        }

        await epicRepository.RemoveAsync(epic, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
