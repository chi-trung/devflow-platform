using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IEpicDependencyRepository
{
    Task AddAsync(EpicDependency dependency, CancellationToken cancellationToken = default);

    Task RemoveAsync(Guid epicId, Guid blockedById, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EpicDependency>> GetForEpicAsync(Guid epicId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<EpicDependency>> GetForEpicsAsync(IEnumerable<Guid> epicIds, CancellationToken cancellationToken = default);
}
