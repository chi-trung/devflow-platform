using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IMilestoneRepository
{
    Task AddAsync(Milestone milestone, CancellationToken cancellationToken = default);

    Task<Milestone?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Milestone>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(Milestone milestone, CancellationToken cancellationToken = default);
}