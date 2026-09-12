using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITimeEntryRepository
{
    Task<IReadOnlyList<TimeEntry>> GetByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task<TimeEntry?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<int> GetTotalMinutesByTaskIdAsync(Guid taskId, CancellationToken cancellationToken = default);

    Task AddAsync(TimeEntry entry, CancellationToken cancellationToken = default);

    void Remove(TimeEntry entry);

    /// <summary>
    /// All entries for a set of tasks (backup export). Ordering is not
    /// guaranteed; callers sort or map as needed.
    /// </summary>
    Task<IReadOnlyList<TimeEntry>> GetForTaskIdsAsync(
        IReadOnlyCollection<Guid> taskIds, CancellationToken cancellationToken = default);

    /// <summary>
    /// Minutes logged by a user, counted only on tasks that live in the given
    /// workspace. TimeEntry has no workspace column and no soft-delete filter,
    /// so scoping goes through the owning task → project chain (which also
    /// drops minutes on soft-deleted tasks).
    /// </summary>
    Task<int> GetTotalMinutesByUserIdInWorkspaceAsync(
        Guid userId, Guid workspaceId, CancellationToken cancellationToken = default);
}
