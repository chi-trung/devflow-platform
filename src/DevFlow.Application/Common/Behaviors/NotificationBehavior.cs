using DevFlow.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a command succeeds, if it implements INotificationEvent, creates a notification
/// for the recipient user — unless that user has muted the category in their
/// notification preferences (InApp toggles). Logging failures never fail the command.
/// </summary>
public sealed class NotificationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly INotificationRepository notificationRepository;
    private readonly INotificationPreferencesRepository preferencesRepository;
    private readonly IUserContext userContext;
    private readonly IUserRepository userRepository;
    private readonly IUnitOfWork unitOfWork;
    private readonly ILogger<NotificationBehavior<TRequest, TResponse>> logger;

    public NotificationBehavior(
        INotificationRepository notificationRepository,
        INotificationPreferencesRepository preferencesRepository,
        IUserContext userContext,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        ILogger<NotificationBehavior<TRequest, TResponse>> logger)
    {
        this.notificationRepository = notificationRepository;
        this.preferencesRepository = preferencesRepository;
        this.userContext = userContext;
        this.userRepository = userRepository;
        this.unitOfWork = unitOfWork;
        this.logger = logger;
    }

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var response = await next();

        if (request is INotificationEvent notificationEvent &&
            notificationEvent.RecipientUserId.HasValue &&
            notificationEvent.RecipientUserId.Value != userContext.UserId)
        {
            var recipientId = notificationEvent.RecipientUserId.Value;

            try
            {
                var prefs = await preferencesRepository.GetByUserIdAsync(recipientId, cancellationToken);

                // If the user has muted this notification category in-app, skip creating it.
                if (prefs is not null && !IsInAppAllowed(notificationEvent.NotificationType, prefs))
                {
                    return response;
                }

                // Get actor's display name
                var actor = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
                var actorName = actor?.DisplayName ?? "Someone";

                var notification = Domain.Entities.Notification.Create(
                    recipientId,
                    notificationEvent.NotificationType,
                    notificationEvent.FormatMessage(actorName),
                    notificationEvent.TaskItemId,
                    notificationEvent.ProjectId,
                    notificationEvent.WorkspaceId);

                await notificationRepository.AddAsync(notification, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
            catch (Exception exception)
            {
                logger.LogError(
                    exception,
                    "Failed to create notification for {RequestType}",
                    typeof(TRequest).Name);
            }
        }

        return response;
    }

    private static bool IsInAppAllowed(string notificationType, Domain.Entities.NotificationPreferences prefs)
    {
        return notificationType.ToLowerInvariant() switch
        {
            "commentadded" or "mention" => prefs.InAppOnMention,
            "taskassigned" or "assignment" or "statuschanged" => prefs.InAppOnAssignment,
            "sprintstarted" => prefs.InAppOnSprintStarted,
            _ => true, // RoleChanged, RemovedFromWorkspace, etc. have no mute toggle
        };
    }
}
