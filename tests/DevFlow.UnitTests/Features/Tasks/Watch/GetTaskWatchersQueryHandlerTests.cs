using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Watch;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Watch;

public class GetTaskWatchersQueryHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskWatcherRepository _watcherRepository = Substitute.For<ITaskWatcherRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public GetTaskWatchersQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _task = TaskItem.Create(_projectId, "Task", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    private GetTaskWatchersQueryHandler CreateHandler() =>
        new(_taskItemRepository, _watcherRepository, _userRepository);

    [Fact]
    public async Task ShouldReturnWatchers_WithUsernamesAndDisplayNames()
    {
        var watcher1 = Guid.NewGuid();
        var watcher2 = Guid.NewGuid();

        _watcherRepository.GetByTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { TaskWatcher.Create(_task.Id, watcher1), TaskWatcher.Create(_task.Id, watcher2) });
        _userRepository.GetByIdsAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, User>
            {
                [watcher1] = User.Create("alice@devflow.dev", "alice", "hash", "Alice"),
                [watcher2] = User.Create("bob@devflow.dev", "bob", "hash", "Bob"),
            });

        var handler = CreateHandler();
        var result = await handler.Handle(
            new GetTaskWatchersQuery(_workspaceId, _projectId, _task.Id),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, w => w.UserId == watcher1 && w.Username == "alice" && w.DisplayName == "Alice");
        Assert.Contains(result, w => w.UserId == watcher2 && w.Username == "bob" && w.DisplayName == "Bob");
    }

    [Fact]
    public async Task ShouldReturnUnknownFallback_WhenUserDeleted()
    {
        var watcher1 = Guid.NewGuid();
        var orphan = Guid.NewGuid();

        _watcherRepository.GetByTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { TaskWatcher.Create(_task.Id, watcher1), TaskWatcher.Create(_task.Id, orphan) });
        _userRepository.GetByIdsAsync(Arg.Any<IEnumerable<Guid>>(), Arg.Any<CancellationToken>())
            .Returns(new Dictionary<Guid, User>
            {
                [watcher1] = User.Create("alice@devflow.dev", "alice", "hash", "Alice"),
            });

        var handler = CreateHandler();
        var result = await handler.Handle(
            new GetTaskWatchersQuery(_workspaceId, _projectId, _task.Id),
            CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, w => w.UserId == orphan && w.Username == "unknown" && w.DisplayName == "Unknown");
    }

    [Fact]
    public async Task ShouldReturnEmpty_WhenNoWatchers()
    {
        _watcherRepository.GetByTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskWatcher>());

        var handler = CreateHandler();
        var result = await handler.Handle(
            new GetTaskWatchersQuery(_workspaceId, _projectId, _task.Id),
            CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenTaskMissing()
    {
        _taskItemRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((TaskItem?)null);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskWatchersQuery(_workspaceId, _projectId, Guid.NewGuid()), CancellationToken.None));
    }

    [Fact]
    public async Task ShouldThrowNotFound_WhenTaskInDifferentProject()
    {
        var foreign = TaskItem.Create(Guid.NewGuid(), "Foreign", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(foreign.Id, Arg.Any<CancellationToken>()).Returns(foreign);

        var handler = CreateHandler();

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new GetTaskWatchersQuery(_workspaceId, _projectId, foreign.Id), CancellationToken.None));
    }
}
