using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Watch;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Watch;

public class TaskWatcherHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskWatcherRepository _watcherRepository = Substitute.For<ITaskWatcherRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public TaskWatcherHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Watch me", null, TaskItemPriority.Medium);
        _userContext.UserId.Returns(_userId);

        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
    }

    [Fact]
    public async Task Watch_ShouldAddWatcher()
    {
        _watcherRepository.ExistsAsync(_task.Id, _userId, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new WatchTaskCommandHandler(_taskItemRepository, _watcherRepository, _userContext, _unitOfWork);
        await handler.Handle(new WatchTaskCommand(_workspaceId, _project.Id, _task.Id), CancellationToken.None);

        await _watcherRepository.Received(1).AddAsync(
            Arg.Is<TaskWatcher>(w => w.TaskItemId == _task.Id && w.UserId == _userId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Watch_ShouldNotDuplicate_WhenAlreadyWatching()
    {
        _watcherRepository.ExistsAsync(_task.Id, _userId, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new WatchTaskCommandHandler(_taskItemRepository, _watcherRepository, _userContext, _unitOfWork);
        await handler.Handle(new WatchTaskCommand(_workspaceId, _project.Id, _task.Id), CancellationToken.None);

        await _watcherRepository.DidNotReceive().AddAsync(Arg.Any<TaskWatcher>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Unwatch_ShouldRemoveWatcher()
    {
        var handler = new UnwatchTaskCommandHandler(_taskItemRepository, _watcherRepository, _userContext, _unitOfWork);
        await handler.Handle(new UnwatchTaskCommand(_workspaceId, _project.Id, _task.Id), CancellationToken.None);

        await _watcherRepository.Received(1).RemoveAsync(_task.Id, _userId, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task IsWatching_ShouldReturnTrue_WhenWatcherExists()
    {
        _watcherRepository.ExistsAsync(_task.Id, _userId, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new IsWatchingTaskQueryHandler(_taskItemRepository, _watcherRepository, _userContext);
        var result = await handler.Handle(new IsWatchingTaskQuery(_workspaceId, _project.Id, _task.Id), CancellationToken.None);

        Assert.True(result);
    }

    [Fact]
    public async Task IsWatching_ShouldReturnFalse_WhenNoWatcher()
    {
        _watcherRepository.ExistsAsync(_task.Id, _userId, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new IsWatchingTaskQueryHandler(_taskItemRepository, _watcherRepository, _userContext);
        var result = await handler.Handle(new IsWatchingTaskQuery(_workspaceId, _project.Id, _task.Id), CancellationToken.None);

        Assert.False(result);
    }
}
