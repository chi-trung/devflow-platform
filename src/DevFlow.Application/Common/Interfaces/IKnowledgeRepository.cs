using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IKnowledgeRepository
{
    Task AddAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default);

    Task<KnowledgeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<KnowledgeEntry>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(KnowledgeEntry entry, CancellationToken cancellationToken = default);
}