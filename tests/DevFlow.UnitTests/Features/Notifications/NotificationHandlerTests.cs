using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Common.Models;
using DevFlow.Application.Features.Notifications;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Notifications;

public class NotificationHandlerTests
{
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();

    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();

    public NotificationHandlerTests()
    {
        _userContext.UserId.Returns(_userId);
    }

    [Fact]
    public async Task DeleteNotification_ShouldDeleteOwnNotification()
    {
        var notification = Notification.Create(_userId, "TaskAssigned", "New task", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        _notificationRepository.GetByIdAsync(notification.Id, Arg.Any<CancellationToken>()).Returns(notification);

        var handler = new DeleteNotificationCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var command = new DeleteNotificationCommand(notification.Id);

        await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.Received(1).DeleteAsync(notification, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteNotification_ShouldThrowNotFound_WhenNotificationDoesNotExist()
    {
        _notificationRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Notification?)null);

        var handler = new DeleteNotificationCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var command = new DeleteNotificationCommand(Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteNotification_ShouldThrowForbidden_WhenNotificationBelongsToAnotherUser()
    {
        var notification = Notification.Create(_otherUserId, "TaskAssigned", "New task", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        _notificationRepository.GetByIdAsync(notification.Id, Arg.Any<CancellationToken>()).Returns(notification);

        var handler = new DeleteNotificationCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var command = new DeleteNotificationCommand(notification.Id);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task DeleteAllReadNotifications_ShouldDeleteAllReadForCurrentUser()
    {
        var readNotifications = new List<Notification>
        {
            Notification.Create(_userId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
            Notification.Create(_userId, "CommentMention", "Mention 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid())
        };

        _notificationRepository.DeleteAllReadForUserAsync(_userId, Arg.Any<CancellationToken>()).Returns(Task.CompletedTask);

        var handler = new DeleteAllReadNotificationsCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var command = new DeleteAllReadNotificationsCommand();

        await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.Received(1).DeleteAllReadForUserAsync(_userId, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Cleanup_ShouldDeleteNotificationsOlderThanCutoff()
    {
        _notificationRepository
            .DeleteOlderThanAsync(_userId, Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(Task.CompletedTask);

        var handler = new CleanupNotificationsCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var command = new CleanupNotificationsCommand(90);

        var deleted = await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.Received(1).DeleteOlderThanAsync(
            _userId,
            Arg.Is<DateTimeOffset>(cutoff => cutoff < DateTimeOffset.UtcNow.AddDays(-89)),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task GetNotifications_ShouldReturnPagedResults()
    {
        var notifications = new List<Notification>
        {
            Notification.Create(_userId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
            Notification.Create(_userId, "CommentMention", "Mention 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
            Notification.Create(_userId, "TaskAssigned", "Task 2", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid())
        };

        _notificationRepository.GetForUserAsync(_userId, int.MaxValue, Arg.Any<CancellationToken>()).Returns(notifications);
        _userRepository.GetDisplayNamesAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var handler = new GetNotificationsHandler(_notificationRepository, _userContext, _userRepository);
        var query = new GetNotificationsQuery(1, 2, false);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Equal(3, result.TotalCount);
        Assert.Equal(2, result.TotalPages);
        Assert.Equal(1, result.Page);
        Assert.Equal(2, result.PageSize);
        Assert.Equal(2, result.Items.Count);
    }

    [Fact]
    public async Task GetNotifications_ShouldFilterUnreadOnly()
    {
        var notifications = new List<Notification>
        {
            Notification.Create(_userId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid()),
            Notification.Create(_userId, "CommentMention", "Mention 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid())
        };
        notifications[0].MarkAsRead();

        _notificationRepository.GetForUserAsync(_userId, int.MaxValue, Arg.Any<CancellationToken>()).Returns(notifications);
        _userRepository.GetDisplayNamesAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var handler = new GetNotificationsHandler(_notificationRepository, _userContext, _userRepository);
        var query = new GetNotificationsQuery(1, 20, true);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        Assert.Single(result.Items);
        Assert.Null(result.Items[0].ReadAtUtc);
    }

    [Fact]
    public async Task GetNotifications_ShouldResolveActorName_WhenActorUserIdPresent()
    {
        var actorId = Guid.NewGuid();
        var notifications = new List<Notification>
        {
            Notification.Create(_userId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), actorId)
        };

        _notificationRepository.GetForUserAsync(_userId, int.MaxValue, Arg.Any<CancellationToken>()).Returns(notifications);
        _userRepository.GetDisplayNamesAsync(Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [actorId] = "Alice" });

        var handler = new GetNotificationsHandler(_notificationRepository, _userContext, _userRepository);
        var query = new GetNotificationsQuery(1, 20, false);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result.Items);
        Assert.Equal(actorId, result.Items[0].ActorUserId);
        Assert.Equal("Alice", result.Items[0].ActorName);
    }

    [Fact]
    public async Task MarkNotificationUnread_ShouldMarkNotificationUnread()
    {
        var notification = Notification.Create(_userId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        _notificationRepository.GetByIdAsync(notification.Id, Arg.Any<CancellationToken>()).Returns(notification);

        var handler = new MarkNotificationUnreadHandler(_notificationRepository, _unitOfWork);
        var command = new MarkNotificationUnreadCommand(_userId, notification.Id);

        await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.Received(1).MarkAsUnreadAsync(notification.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task MarkNotificationUnread_ShouldThrowForbidden_WhenNotificationBelongsToAnotherUser()
    {
        var notification = Notification.Create(_otherUserId, "TaskAssigned", "Task 1", Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());
        _notificationRepository.GetByIdAsync(notification.Id, Arg.Any<CancellationToken>()).Returns(notification);

        var handler = new MarkNotificationUnreadHandler(_notificationRepository, _unitOfWork);
        var command = new MarkNotificationUnreadCommand(_userId, notification.Id);

        await Assert.ThrowsAsync<ForbiddenAccessException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task MarkNotificationUnread_ShouldThrowNotFound_WhenNotificationDoesNotExist()
    {
        _notificationRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Notification?)null);

        var handler = new MarkNotificationUnreadHandler(_notificationRepository, _unitOfWork);
        var command = new MarkNotificationUnreadCommand(_userId, Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
