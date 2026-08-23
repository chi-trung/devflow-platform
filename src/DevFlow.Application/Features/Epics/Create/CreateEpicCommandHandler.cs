using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Epics.Create;

public sealed class CreateEpicCommandHandler(
    IProjectRepository projectRepository,
    IEpicRepository epicRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateEpicCommand, EpicCreatedResponse>
{
    public async Task<EpicCreatedResponse> Handle(
        CreateEpicCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var epic = Epic.Create(
            command.ProjectId,
            command.Name,
            command.Description,
            command.StartDateUtc,
            command.EndDateUtc);

        await epicRepository.AddAsync(epic, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new EpicCreatedResponse(epic.Id);
    }
}
