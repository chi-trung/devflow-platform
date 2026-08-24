using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface ISprintRepository
{
    Task AddAsync(Sprint sprint, CancellationToken cancellationToken = default);

    Task<Sprint?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Sprint>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<bool> HasActiveSprintAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(Sprint sprint, CancellationToken cancellationToken = default);
}
