using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IEpicRepository
{
    Task AddAsync(Epic epic, CancellationToken cancellationToken = default);

    Task<Epic?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Epic>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(Epic epic, CancellationToken cancellationToken = default);
}
