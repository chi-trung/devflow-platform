using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Notifications;

public sealed class GetNotificationsHandler(
    INotificationRepository notificationRepository) : IRequestHandler<GetNotificationsQuery, IReadOnlyList<NotificationResponse>>
{
    public async Task<IReadOnlyList<NotificationResponse>> Handle(
        GetNotificationsQuery query,
        CancellationToken cancellationToken)
    {
        var notifications = await notificationRepository.GetForUserAsync(
            query.UserId,
            take: 20,
            cancellationToken);

        return notifications
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
