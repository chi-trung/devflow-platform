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

// Commands
public sealed record GetNotificationsQuery(Guid UserId) : IRequest<IReadOnlyList<NotificationResponse>>;

public sealed record GetUnreadCountQuery(Guid UserId) : IRequest<int>;

public sealed record MarkNotificationReadCommand(Guid UserId, Guid NotificationId) : IRequest;

public sealed record MarkAllNotificationsReadCommand(Guid UserId) : IRequest;
