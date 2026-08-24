using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface INotificationRepository
{
    Task AddAsync(Notification notification, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Notification>> GetForUserAsync(
        Guid userId,
        int take = 20,
        CancellationToken cancellationToken = default);

    Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default);

    Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default);

    Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default);

    Task DeleteAsync(Notification notification, CancellationToken cancellationToken = default);

    Task DeleteAllReadForUserAsync(Guid userId, CancellationToken cancellationToken = default);

    Task DeleteOlderThanAsync(Guid userId, DateTimeOffset cutoff, CancellationToken cancellationToken = default);
}
