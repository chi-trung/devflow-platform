using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Supersede;

public sealed class SupersedeKnowledgeEntryCommandHandler(
    IProjectRepository projectRepository,
    IKnowledgeRepository knowledgeRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<SupersedeKnowledgeEntryCommand>
{
    public async Task Handle(SupersedeKnowledgeEntryCommand command, CancellationToken cancellationToken)
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

        var supersedingEntry = await knowledgeRepository.GetByIdAsync(command.SupersededByEntryId, cancellationToken);

        if (supersedingEntry is null || supersedingEntry.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(KnowledgeEntry), command.SupersededByEntryId);
        }

        entry.MarkSupersededBy(command.SupersededByEntryId);

        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
