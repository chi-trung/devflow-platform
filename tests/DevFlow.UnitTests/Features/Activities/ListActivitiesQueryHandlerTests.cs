using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Activities;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Activities;

public class ListActivitiesQueryHandlerTests
{
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ListActivitiesQueryHandler _handler;

    public ListActivitiesQueryHandlerTests()
    {
        _handler = new ListActivitiesQueryHandler(_activityLogRepository, _userRepository);
    }

    [Fact]
    public async Task Handle_ShouldReturnPagedActivitiesWithResolvedActorNames()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var taskId = Guid.NewGuid();

        var log = ActivityLog.Create(workspaceId, projectId, taskId, actorId, "created task", "Fix bug");

        _activityLogRepository.GetFilteredAsync(
            projectId, null, null, null, null, null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([log], 1));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [actorId] = "Alice" });

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId), CancellationToken.None);

        var item = Assert.Single(response.Items);
        Assert.Equal("Alice", item.ActorName);
        Assert.Equal("created task", item.Action);
        Assert.Equal("Fix bug", item.Target);
        Assert.Equal(taskId, item.TaskItemId);
        Assert.Equal(1, response.TotalCount);
        Assert.Equal(1, response.Page);
        Assert.Equal(50, response.PageSize);
    }

    [Fact]
    public async Task Handle_ShouldFallbackToSomeone_WhenActorNotFound()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var log = ActivityLog.Create(workspaceId, projectId, null, actorId, "started sprint", "Sprint 1");

        _activityLogRepository.GetFilteredAsync(
            projectId, null, null, null, null, null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([log], 1));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId), CancellationToken.None);

        var item = Assert.Single(response.Items);
        Assert.Equal("Someone", item.ActorName);
    }

    // ── D25.1: Filter tests ────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ShouldFilterByActorUserId()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        _activityLogRepository.GetFilteredAsync(
            projectId, actorId, null, null, null, null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([], 0));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId, ActorUserId: actorId), CancellationToken.None);

        Assert.Empty(response.Items);
        Assert.Equal(0, response.TotalCount);
        await _activityLogRepository.Received(1).GetFilteredAsync(
            projectId, actorId, null, null, null, null, 0, 50, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldFilterByTaskItemId()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var taskId = Guid.NewGuid();

        var log = ActivityLog.Create(workspaceId, projectId, taskId, Guid.NewGuid(), "updated task", "Fix bug");

        _activityLogRepository.GetFilteredAsync(
            projectId, null, taskId, null, null, null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([log], 1));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId, TaskItemId: taskId), CancellationToken.None);

        Assert.Single(response.Items);
        await _activityLogRepository.Received(1).GetFilteredAsync(
            projectId, null, taskId, null, null, null, 0, 50, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldFilterByAction()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        _activityLogRepository.GetFilteredAsync(
            projectId, null, null, "created task", null, null, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([], 0));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId, Action: "created task"), CancellationToken.None);

        Assert.Empty(response.Items);
        await _activityLogRepository.Received(1).GetFilteredAsync(
            projectId, null, null, "created task", null, null, 0, 50, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldPaginateCorrectly()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();

        _activityLogRepository.GetFilteredAsync(
            projectId, null, null, null, null, null, 10, 10, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([], 25));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId, Take: 10, Page: 2), CancellationToken.None);

        Assert.Empty(response.Items);
        Assert.Equal(25, response.TotalCount);
        Assert.Equal(2, response.Page);
        Assert.Equal(10, response.PageSize);
        await _activityLogRepository.Received(1).GetFilteredAsync(
            projectId, null, null, null, null, null, 10, 10, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldFilterByDateRange()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var from = DateTimeOffset.UtcNow.AddDays(-7);
        var to = DateTimeOffset.UtcNow;

        _activityLogRepository.GetFilteredAsync(
            projectId, null, null, null, from, to, 0, 50, Arg.Any<CancellationToken>())
            .Returns(new ActivityLogPage([], 0));

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId, FromUtc: from, ToUtc: to), CancellationToken.None);

        Assert.Empty(response.Items);
        await _activityLogRepository.Received(1).GetFilteredAsync(
            projectId, null, null, null, from, to, 0, 50, Arg.Any<CancellationToken>());
    }
}
