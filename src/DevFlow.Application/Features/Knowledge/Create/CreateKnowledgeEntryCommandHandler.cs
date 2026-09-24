using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.Create;

public sealed class CreateKnowledgeEntryCommandHandler(
    IProjectRepository projectRepository,
    IKnowledgeRepository knowledgeRepository,
    IOutboxDispatcher outboxDispatcher,
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

        // After the entry exists, queue chunk+embed so the HTTP path never
        // blocks on embedding latency. OutboxDispatcher swallows enqueue
        // failures (logs only) — the entry itself is already durable.
        await outboxDispatcher.EnqueueAsync(
            "knowledge.reembed",
            new
            {
                workspaceId = command.WorkspaceId,
                knowledgeEntryId = entry.Id,
                projectId = command.ProjectId,
            },
            cancellationToken);

        return new KnowledgeEntryCreatedResponse(entry.Id);
    }
}
