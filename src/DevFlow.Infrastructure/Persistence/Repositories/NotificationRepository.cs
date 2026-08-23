using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class NotificationRepository(DevFlowDbContext dbContext) : INotificationRepository
{
    public async Task AddAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        await dbContext.Notifications.AddAsync(notification, cancellationToken);
    }

    public async Task<IReadOnlyList<Notification>> GetForUserAsync(
        Guid userId,
        int take = 20,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Notifications
            .AsNoTracking()
            .Where(n => n.UserId == userId)
            .OrderByDescending(n => n.CreatedAtUtc)
            .Take(take)
            .ToListAsync(cancellationToken);
    }

    public async Task<int> GetUnreadCountAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        return await dbContext.Notifications
            .AsNoTracking()
            .CountAsync(n => n.UserId == userId && n.ReadAtUtc == null, cancellationToken);
    }

    public async Task<Notification?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return await dbContext.Notifications
            .FirstOrDefaultAsync(n => n.Id == id, cancellationToken);
    }

    public async Task MarkAsReadAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var notification = await dbContext.Notifications.FindAsync([id], cancellationToken);
        if (notification is not null)
        {
            notification.MarkAsRead();
        }
    }

    public async Task MarkAllAsReadAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var unread = await dbContext.Notifications
            .Where(n => n.UserId == userId && n.ReadAtUtc == null)
            .ToListAsync(cancellationToken);

        foreach (var notification in unread)
        {
            notification.MarkAsRead();
        }
    }

    public async Task DeleteAsync(Notification notification, CancellationToken cancellationToken = default)
    {
        dbContext.Notifications.Remove(notification);
        await Task.CompletedTask;
    }

    public async Task DeleteAllReadForUserAsync(Guid userId, CancellationToken cancellationToken = default)
    {
        var read = await dbContext.Notifications
            .Where(n => n.UserId == userId && n.ReadAtUtc != null)
            .ToListAsync(cancellationToken);

        dbContext.Notifications.RemoveRange(read);
        await Task.CompletedTask;
    }
}
