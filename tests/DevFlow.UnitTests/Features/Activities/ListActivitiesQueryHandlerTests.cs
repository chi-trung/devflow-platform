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
    public async Task Handle_ShouldReturnActivitiesWithResolvedActorNames()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var actorId = Guid.NewGuid();
        var taskId = Guid.NewGuid();

        var log = ActivityLog.Create(workspaceId, projectId, taskId, actorId, "created task", "Fix bug");

        _activityLogRepository.GetForProjectAsync(projectId, 50, Arg.Any<CancellationToken>())
            .Returns([log]);

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [actorId] = "Alice" });

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId), CancellationToken.None);

        var item = Assert.Single(response);
        Assert.Equal("Alice", item.ActorName);
        Assert.Equal("created task", item.Action);
        Assert.Equal("Fix bug", item.Target);
        Assert.Equal(taskId, item.TaskItemId);
    }

    [Fact]
    public async Task Handle_ShouldFallbackToSomeone_WhenActorNotFound()
    {
        var workspaceId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var log = ActivityLog.Create(workspaceId, projectId, null, actorId, "started sprint", "Sprint 1");

        _activityLogRepository.GetForProjectAsync(projectId, 50, Arg.Any<CancellationToken>())
            .Returns([log]);

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var response = await _handler.Handle(
            new ListActivitiesQuery(workspaceId, projectId), CancellationToken.None);

        var item = Assert.Single(response);
        Assert.Equal("Someone", item.ActorName);
    }
}
