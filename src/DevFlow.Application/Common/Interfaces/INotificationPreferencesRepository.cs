using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface INotificationPreferencesRepository
{
    Task<NotificationPreferences?> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
