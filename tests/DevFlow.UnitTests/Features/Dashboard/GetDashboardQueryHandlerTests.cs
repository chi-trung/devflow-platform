using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Dashboard;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Dashboard;

public class GetDashboardQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public GetDashboardQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns([_project]);

        // Execute the factory directly so tests exercise the load path.
        _cacheService
            .GetOrSetAsync(
                Arg.Any<string>(),
                Arg.Any<Func<CancellationToken, Task<DashboardResponse>>>(),
                Arg.Any<TimeSpan?>(),
                Arg.Any<IEnumerable<string>>(),
                Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                var factory = callInfo.ArgAt<Func<CancellationToken, Task<DashboardResponse>>>(1);
                return factory(CancellationToken.None);
            });
    }

    [Fact]
    public async Task Handle_ShouldUseSingleBatchQuery_AndResolveActorNames()
    {
        var actorId = Guid.NewGuid();
        var task = TaskItem.Create(_project.Id, "Deadline task", null, TaskItemPriority.High);
        task.UpdateDetails("Deadline task", null, TaskItemPriority.High, DateTimeOffset.UtcNow.AddDays(2));
        task.ChangeStatus(TaskItemStatus.InProgress);

        var log = ActivityLog.Create(_workspaceId, _project.Id, task.Id, actorId, "created task", "Deadline task");

        _taskItemRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns([task]);

        _activityLogRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), 5, Arg.Any<CancellationToken>())
            .Returns([log]);

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string> { [actorId] = "Alice" });

        var handler = new GetDashboardQueryHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userRepository, _cacheService);

        var response = await handler.Handle(new GetDashboardQuery(_workspaceId), CancellationToken.None);

        Assert.Equal(1, response.TotalTasks);
        Assert.Equal(1, response.TasksByStatus["InProgress"]);
        Assert.Equal(1, response.TasksByPriority["High"]);

        var activity = Assert.Single(response.RecentActivity);
        Assert.Equal("Alice", activity.ActorName);
        Assert.Equal("created task", activity.Verb);

        var deadline = Assert.Single(response.UpcomingDeadlines);
        Assert.Equal("DEV", deadline.ProjectKey);
        Assert.Equal("Deadline task", deadline.Title);

        // Both batch methods called exactly once — no per-project loop.
        await _taskItemRepository.Received(1).GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), 5, Arg.Any<CancellationToken>());
        await _userRepository.Received(1).GetDisplayNamesAsync(
            Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldFallbackToSomeone_WhenActorUnknown()
    {
        var actorId = Guid.NewGuid();
        var task = TaskItem.Create(_project.Id, "Task", null, TaskItemPriority.Medium);
        var log = ActivityLog.Create(_workspaceId, _project.Id, task.Id, actorId, "updated task", "Task");

        _taskItemRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns([task]);

        _activityLogRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), 5, Arg.Any<CancellationToken>())
            .Returns([log]);

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var handler = new GetDashboardQueryHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userRepository, _cacheService);

        var response = await handler.Handle(new GetDashboardQuery(_workspaceId), CancellationToken.None);

        var activity = Assert.Single(response.RecentActivity);
        Assert.Equal("Someone", activity.ActorName);
    }

    [Fact]
    public async Task Handle_ShouldCapRecentActivity_ToTop5Overall()
    {
        var task = TaskItem.Create(_project.Id, "Task", null, TaskItemPriority.Medium);
        var logs = Enumerable.Range(0, 8)
            .Select(i => ActivityLog.Create(_workspaceId, _project.Id, task.Id, Guid.NewGuid(), $"action {i}", $"target {i}"))
            .OrderBy(l => l.CreatedAtUtc) // not pre-sorted, handler must order
            .ToList();

        _taskItemRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns([task]);

        _activityLogRepository.GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), 5, Arg.Any<CancellationToken>())
            .Returns(logs);

        _userRepository.GetDisplayNamesAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, string>());

        var handler = new GetDashboardQueryHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userRepository, _cacheService);

        var response = await handler.Handle(new GetDashboardQuery(_workspaceId), CancellationToken.None);

        Assert.Equal(5, response.RecentActivity.Count);
    }
}
