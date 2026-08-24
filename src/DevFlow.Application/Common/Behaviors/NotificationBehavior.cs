using DevFlow.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace DevFlow.Application.Common.Behaviors;

/// <summary>
/// After a command succeeds, if it implements INotificationEvent, creates a notification
/// for the recipient user. Logging failures never fail the command itself.
/// </summary>
public sealed class NotificationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly INotificationRepository notificationRepository;
    private readonly IUserContext userContext;
    private readonly IUserRepository userRepository;
    private readonly IUnitOfWork unitOfWork;
    private readonly ILogger<NotificationBehavior<TRequest, TResponse>> logger;

    public NotificationBehavior(
        INotificationRepository notificationRepository,
        IUserContext userContext,
        IUserRepository userRepository,
        IUnitOfWork unitOfWork,
        ILogger<NotificationBehavior<TRequest, TResponse>> logger)
    {
        this.notificationRepository = notificationRepository;
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
            try
            {
                // Get actor's display name
                var actor = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
                var actorName = actor?.DisplayName ?? "Someone";

                var notification = Domain.Entities.Notification.Create(
                    notificationEvent.RecipientUserId.Value,
                    notificationEvent.NotificationType,
                    notificationEvent.FormatMessage(actorName),
                    notificationEvent.TaskItemId,
                    notificationEvent.ProjectId,
                    notificationEvent.WorkspaceId,
                    actor?.Id);

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
}
