using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Create;

public sealed class CreateKnowledgeEntryCommandHandler(
    IProjectRepository projectRepository,
    IKnowledgeRepository knowledgeRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateKnowledgeEntryCommand, KnowledgeEntryCreatedResponse>
{
    public async Task<KnowledgeEntryCreatedResponse> Handle(
        CreateKnowledgeEntryCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var entry = KnowledgeEntry.Create(
            command.ProjectId,
            command.Title,
            command.Body,
            command.Type,
            command.Tags);

        await knowledgeRepository.AddAsync(entry, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new KnowledgeEntryCreatedResponse(entry.Id);
    }
}
