using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Notifications;

public class NotificationBehaviorGatingTests
{
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ILogger<NotificationBehavior<UpdateTaskItemCommand, Unit>> _logger =
        Substitute.For<ILogger<NotificationBehavior<UpdateTaskItemCommand, Unit>>>();

    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _recipientId = Guid.NewGuid();

    public NotificationBehaviorGatingTests()
    {
        _userContext.UserId.Returns(_actorId);
        _userRepository.GetByIdAsync(_actorId, Arg.Any<CancellationToken>())
            .Returns(User.Create("actor@devflow.local", "actor", "Password123!", "Actor Name"));
    }

    private NotificationBehavior<UpdateTaskItemCommand, Unit> CreateBehavior() =>
        new(_notificationRepository, _preferencesRepository, _userContext, _userRepository, _unitOfWork, _logger);

    private static UpdateTaskItemCommand CreateCommand(Guid recipientId) =>
        new(
            Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(),
            "Task", null, TaskItemStatus.Done, TaskItemPriority.Medium,
            recipientId, null);

    [Fact]
    public async Task ShouldCreateNotification_WhenInAppPreferenceIsEnabled()
    {
        var prefs = NotificationPreferences.Create(_recipientId);
        prefs.InAppOnAssignment = true;
        _preferencesRepository.GetByUserIdAsync(_recipientId, Arg.Any<CancellationToken>()).Returns(prefs);

        var behavior = CreateBehavior();
        var command = CreateCommand(_recipientId);

        await behavior.Handle(command, () => Task.FromResult(Unit.Value), CancellationToken.None);

        await _notificationRepository.Received(1).AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldSkipNotification_WhenInAppPreferenceIsDisabled()
    {
        var prefs = NotificationPreferences.Create(_recipientId);
        prefs.InAppOnAssignment = false;
        _preferencesRepository.GetByUserIdAsync(_recipientId, Arg.Any<CancellationToken>()).Returns(prefs);

        var behavior = CreateBehavior();
        var command = CreateCommand(_recipientId);

        await behavior.Handle(command, () => Task.FromResult(Unit.Value), CancellationToken.None);

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldCreateNotification_WhenNoPreferencesExist()
    {
        _preferencesRepository.GetByUserIdAsync(_recipientId, Arg.Any<CancellationToken>()).Returns((NotificationPreferences?)null);

        var behavior = CreateBehavior();
        var command = CreateCommand(_recipientId);

        await behavior.Handle(command, () => Task.FromResult(Unit.Value), CancellationToken.None);

        await _notificationRepository.Received(1).AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldNotNotify_WhenRecipientIsTheActor()
    {
        _preferencesRepository.GetByUserIdAsync(_actorId, Arg.Any<CancellationToken>())
            .Returns((NotificationPreferences?)null);

        var behavior = CreateBehavior();
        var command = CreateCommand(_actorId);

        await behavior.Handle(command, () => Task.FromResult(Unit.Value), CancellationToken.None);

        await _notificationRepository.DidNotReceive().AddAsync(Arg.Any<Notification>(), Arg.Any<CancellationToken>());
    }
}
