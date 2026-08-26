using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Knowledge.List;

public sealed class ListKnowledgeEntriesQueryHandler(
    IProjectRepository projectRepository,
    IKnowledgeRepository knowledgeRepository) : IRequestHandler<ListKnowledgeEntriesQuery, IReadOnlyList<KnowledgeEntryResponse>>
{
    public async Task<IReadOnlyList<KnowledgeEntryResponse>> Handle(
        ListKnowledgeEntriesQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var entries = await knowledgeRepository.GetForProjectAsync(query.ProjectId, cancellationToken);

        return entries
            .Select(BuildResponse)
            .ToList();
    }

    private static KnowledgeEntryResponse BuildResponse(KnowledgeEntry entry)
    {
        return new KnowledgeEntryResponse(
            entry.Id,
            entry.ProjectId,
            entry.TaskId,
            entry.Title,
            entry.Body,
            entry.Type.ToString(),
            entry.Status.ToString(),
            entry.Weight,
            entry.Tags,
            entry.SupersededById,
            entry.CreatedAtUtc,
            entry.UpdatedAtUtc);
    }
}
