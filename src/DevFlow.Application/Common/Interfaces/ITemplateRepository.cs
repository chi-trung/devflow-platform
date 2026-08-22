using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITemplateRepository
{
    Task<IReadOnlyList<TaskTemplate>> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<TaskTemplate?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(TaskTemplate template, CancellationToken cancellationToken = default);

    void Remove(TaskTemplate template);
}
