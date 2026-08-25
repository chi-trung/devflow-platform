using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Notifications;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Notifications;

public class BatchDeleteNotificationsCommandHandlerTests
{
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _userId = Guid.NewGuid();

    public BatchDeleteNotificationsCommandHandlerTests()
    {
        _userContext.UserId.Returns(_userId);
    }

    [Fact]
    public async Task Handle_ShouldDeleteOnlyOwnNotifications_AndReturnCount()
    {
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();

        _notificationRepository.BatchDeleteAsync(_userId, Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(2);

        var handler = new BatchDeleteNotificationsCommandHandler(_notificationRepository, _userContext, _unitOfWork);
        var count = await handler.Handle(new BatchDeleteNotificationsCommand([id1, id2]), CancellationToken.None);

        Assert.Equal(2, count);
        await _notificationRepository.Received(1).BatchDeleteAsync(
            _userId,
            Arg.Is<IReadOnlyList<Guid>>(ids => ids.Contains(id1) && ids.Contains(id2)),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_WithEmptyList_ShouldThrowValidation()
    {
        var handler = new BatchDeleteNotificationsCommandHandler(_notificationRepository, _userContext, _unitOfWork);

        await Assert.ThrowsAsync<ValidationException>(
            () => handler.Handle(new BatchDeleteNotificationsCommand([]), CancellationToken.None));

        await _notificationRepository.DidNotReceive().BatchDeleteAsync(Arg.Any<Guid>(), Arg.Any<IReadOnlyList<Guid>>(), Arg.Any<CancellationToken>());
    }
}
