using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Notifications;

public sealed record BatchDeleteNotificationsCommand(
    IReadOnlyList<Guid> Ids) : IRequest<int>;

public sealed class BatchDeleteNotificationsCommandHandler(
    INotificationRepository notificationRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<BatchDeleteNotificationsCommand, int>
{
    public async Task<int> Handle(BatchDeleteNotificationsCommand command, CancellationToken cancellationToken)
    {
        if (command.Ids is null || command.Ids.Count == 0)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["Ids"] = ["At least one notification ID is required."],
            });
        }

        var count = await notificationRepository.BatchDeleteAsync(userContext.UserId, command.Ids, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return count;
    }
}