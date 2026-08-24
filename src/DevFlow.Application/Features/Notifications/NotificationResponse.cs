using DevFlow.Application.Common.Models;
using MediatR;

namespace DevFlow.Application.Features.Notifications;

public sealed record NotificationResponse(
    Guid Id,
    string Type,
    string Message,
    DateTimeOffset CreatedAtUtc,
    DateTimeOffset? ReadAtUtc,
    Guid? TaskItemId,
    Guid? ProjectId,
    Guid? WorkspaceId);

public sealed record GetNotificationsQuery(
    int Page,
    int PageSize,
    bool UnreadOnly) : IRequest<PagedResult<NotificationResponse>>;

public sealed record GetUnreadCountQuery(Guid UserId) : IRequest<int>;

public sealed record MarkNotificationReadCommand(
    Guid UserId,
    Guid NotificationId) : IRequest;

public sealed record MarkAllNotificationsReadCommand(Guid UserId) : IRequest;

public sealed record DeleteNotificationCommand(Guid NotificationId) : IRequest;

public sealed record DeleteAllReadNotificationsCommand : IRequest;

public sealed record CleanupNotificationsCommand(int Days = 90) : IRequest<int>;
