using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITimeEntryRepository
{
    Task<IReadOnlyList<TimeEntry>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<TimeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<int> GetTotalMinutesByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task AddAsync(TimeEntry entry, CancellationToken cancellationToken = default);

    void Remove(TimeEntry entry);
}
