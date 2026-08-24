using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Notifications;

public sealed class GetNotificationsHandler(
    INotificationRepository notificationRepository,
    IUserContext userContext) : IRequestHandler<GetNotificationsQuery, PagedResult<NotificationResponse>>
{
    public async Task<PagedResult<NotificationResponse>> Handle(
        GetNotificationsQuery query,
        CancellationToken cancellationToken)
    {
        var page = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, 100);
        var userId = userContext.UserId;

        var allNotifications = await notificationRepository.GetForUserAsync(
            userId,
            take: int.MaxValue,
            cancellationToken);

        var filtered = query.UnreadOnly
            ? allNotifications.Where(n => !n.IsRead).ToList()
            : allNotifications.ToList();

        var totalCount = filtered.Count;
        var skip = (page - 1) * pageSize;
        var items = filtered
            .OrderByDescending(n => n.CreatedAtUtc)
            .Skip(skip)
            .Take(pageSize)
            .Select(n => new NotificationResponse(
                n.Id,
                n.Type,
                n.Message,
                n.CreatedAtUtc,
                n.ReadAtUtc,
                n.TaskItemId,
                n.ProjectId,
                n.WorkspaceId))
            .ToList();

        return new PagedResult<NotificationResponse>(items, totalCount, page, pageSize);
    }
}

public sealed class GetUnreadCountHandler(
    INotificationRepository notificationRepository) : IRequestHandler<GetUnreadCountQuery, int>
{
    public async Task<int> Handle(GetUnreadCountQuery query, CancellationToken cancellationToken)
    {
        return await notificationRepository.GetUnreadCountAsync(query.UserId, cancellationToken);
    }
}

public sealed class MarkNotificationReadHandler(
    INotificationRepository notificationRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<MarkNotificationReadCommand>
{
    public async Task Handle(MarkNotificationReadCommand command, CancellationToken cancellationToken)
    {
        var notification = await notificationRepository.GetByIdAsync(command.NotificationId, cancellationToken);

        if (notification is null)
        {
            throw new NotFoundException(nameof(Notification), command.NotificationId);
        }

        if (notification.UserId != command.UserId)
        {
            throw new ForbiddenAccessException();
        }

        await notificationRepository.MarkAsReadAsync(command.NotificationId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class MarkAllNotificationsReadHandler(
    INotificationRepository notificationRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<MarkAllNotificationsReadCommand>
{
    public async Task Handle(MarkAllNotificationsReadCommand command, CancellationToken cancellationToken)
    {
        await notificationRepository.MarkAllAsReadAsync(command.UserId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteNotificationCommandHandler(
    INotificationRepository notificationRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteNotificationCommand>
{
    public async Task Handle(DeleteNotificationCommand command, CancellationToken cancellationToken)
    {
        var notification = await notificationRepository.GetByIdAsync(command.NotificationId, cancellationToken);

        if (notification is null)
        {
            throw new NotFoundException(nameof(Notification), command.NotificationId);
        }

        if (notification.UserId != userContext.UserId)
        {
            throw new ForbiddenAccessException();
        }

        await notificationRepository.DeleteAsync(notification, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DeleteAllReadNotificationsCommandHandler(
    INotificationRepository notificationRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteAllReadNotificationsCommand>
{
    public async Task Handle(DeleteAllReadNotificationsCommand command, CancellationToken cancellationToken)
    {
        await notificationRepository.DeleteAllReadForUserAsync(userContext.UserId, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CleanupNotificationsCommandHandler(
    INotificationRepository notificationRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CleanupNotificationsCommand, int>
{
    public async Task<int> Handle(CleanupNotificationsCommand command, CancellationToken cancellationToken)
    {
        var cutoff = DateTimeOffset.UtcNow.AddDays(-command.Days);
        await notificationRepository.DeleteOlderThanAsync(userContext.UserId, cutoff, cancellationToken);
        var affected = await unitOfWork.SaveChangesAsync(cancellationToken);
        return affected;
    }
}
