using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class NotificationPreferencesRepository(
    DevFlowDbContext dbContext) : INotificationPreferencesRepository
{
    public Task<NotificationPreferences?> GetByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return dbContext.NotificationPreferences
            .FirstOrDefaultAsync(np => np.UserId == userId, cancellationToken);
    }
}
