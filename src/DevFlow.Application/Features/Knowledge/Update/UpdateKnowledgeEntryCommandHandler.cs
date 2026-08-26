using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Update;

public sealed class UpdateKnowledgeEntryCommandHandler(
    IProjectRepository projectRepository,
    IKnowledgeRepository knowledgeRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateKnowledgeEntryCommand>
{
    public async Task Handle(UpdateKnowledgeEntryCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var entry = await knowledgeRepository.GetByIdAsync(command.EntryId, cancellationToken);

        if (entry is null || entry.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(KnowledgeEntry), command.EntryId);
        }

        entry.UpdateDetails(command.Title, command.Body, command.Type, command.Tags);
        entry.UpdateStatus(command.Status);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
