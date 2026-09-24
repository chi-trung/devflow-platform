using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.BulkOperations;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Tasks.Dependencies;
using DevFlow.Application.Features.Tasks.Reorder;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Dependencies;

/// <summary>
/// Server-side blocked-move enforcement across the three user-initiated
/// status paths (single update, drag reorder, bulk move). The client guard is
/// advisory; these tests pin that the server refuses the same moves even when
/// a client (or API caller) skips the guard entirely.
/// </summary>
public class BlockedMoveEnforcementTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly ITaskWatcherRepository _watcherRepository = Substitute.For<ITaskWatcherRepository>();
    private readonly IRealtimeNotificationService _realtimeService = Substitute.For<IRealtimeNotificationService>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IKnowledgeRepository _knowledgeRepository = Substitute.For<IKnowledgeRepository>();
    private readonly IOutboxDispatcher _outboxDispatcher = Substitute.For<IOutboxDispatcher>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ITaskDependencyRepository _dependencyRepository = Substitute.For<ITaskDependencyRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public BlockedMoveEnforcementTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    private void WithEdges(params TaskDependency[] edges)
    {
        _dependencyRepository.GetAllByProjectIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(edges.ToList());
    }

    private void WithSnapshots(params TaskStatusSnapshot[] snapshots)
    {
        _dependencyRepository.GetDependencyTaskSnapshotsAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(snapshots.ToList());
    }

    private UpdateTaskItemCommandHandler UpdateHandler() => new(
        _projectRepository, _taskItemRepository, _workspaceRepository, _userRepository,
        _notificationRepository, _preferencesRepository, _watcherRepository, _emailService,
        _realtimeService, _activityLogRepository, _knowledgeRepository, _outboxDispatcher,
        _userContext, _unitOfWork, _dependencyRepository);

    private TaskItem Task(TaskItemStatus status, string title = "Existing")
    {
        var task = TaskItem.Create(_project.Id, title, null, TaskItemPriority.Low);
        if (status != TaskItemStatus.Idea) task.ChangeStatus(status);
        return task;
    }

    // ----- single update -----

    [Fact]
    public async Task Update_StatusChange_WhileBlocked_IsRejected_AndLeavesTaskUntouched()
    {
        var blocked = Task(TaskItemStatus.Ready);
        var blocker = Task(TaskItemStatus.InProgress, "Ship migration");
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, blocked.Id, "Renamed", null,
            TaskItemStatus.Done, TaskItemPriority.Low, null, null);

        var ex = await Assert.ThrowsAsync<ConflictException>(() =>
            UpdateHandler().Handle(command, CancellationToken.None));

        Assert.Contains("Ship migration", ex.Message);
        Assert.Equal(TaskItemStatus.Ready, blocked.Status);
        Assert.Equal("Existing", blocked.Title); // rejection precedes every mutation
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_StatusChange_WhenBlockerIsDone_IsAllowed()
    {
        var blocked = Task(TaskItemStatus.Ready);
        var blocker = Task(TaskItemStatus.Done, "Already shipped");
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        await UpdateHandler().Handle(
            new UpdateTaskItemCommand(
                _workspaceId, _project.Id, blocked.Id, "Existing", null,
                TaskItemStatus.Done, TaskItemPriority.Low, null, null),
            CancellationToken.None);

        Assert.Equal(TaskItemStatus.Done, blocked.Status);
    }

    [Fact]
    public async Task Update_SameStatusSave_IsAllowed_DespiteBlockers()
    {
        // Editing title/priority on a blocked task is not a move.
        var blocked = Task(TaskItemStatus.Review);
        var blocker = Task(TaskItemStatus.InProgress, "Blocker");
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        await UpdateHandler().Handle(
            new UpdateTaskItemCommand(
                _workspaceId, _project.Id, blocked.Id, "Edited title", "desc",
                TaskItemStatus.Review, TaskItemPriority.High, null, null),
            CancellationToken.None);

        Assert.Equal("Edited title", blocked.Title);
        Assert.Equal(TaskItemStatus.Review, blocked.Status);
        // The guard short-circuits before loading the graph at all.
        await _dependencyRepository.DidNotReceive()
            .GetAllByProjectIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_CycleMember_StatusChange_IsAllowed()
    {
        var a = Task(TaskItemStatus.Planning, "A");
        var b = Task(TaskItemStatus.Planning, "B");
        _taskItemRepository.GetByIdAsync(a.Id, Arg.Any<CancellationToken>()).Returns(a);
        WithEdges(TaskDependency.Create(a.Id, b.Id), TaskDependency.Create(b.Id, a.Id));
        WithSnapshots(
            new TaskStatusSnapshot(a.Id, a.Title, a.Status),
            new TaskStatusSnapshot(b.Id, b.Title, b.Status));

        await UpdateHandler().Handle(
            new UpdateTaskItemCommand(
                _workspaceId, _project.Id, a.Id, "A", null,
                TaskItemStatus.Ready, TaskItemPriority.Low, null, null),
            CancellationToken.None);

        Assert.Equal(TaskItemStatus.Ready, a.Status);
    }

    // ----- drag reorder -----

    [Fact]
    public async Task Reorder_CrossColumn_WhileBlocked_RejectsWholeBatch_Unsaved()
    {
        var clear = Task(TaskItemStatus.Idea, "Clear");
        var blocked = Task(TaskItemStatus.Idea, "Blocked");
        var blocker = Task(TaskItemStatus.InProgress, "Blocker");
        _taskItemRepository.GetByIdAsync(clear.Id, Arg.Any<CancellationToken>()).Returns(clear);
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        var handler = new ReorderTasksCommandHandler(
            _taskItemRepository, _projectRepository, _unitOfWork, _dependencyRepository);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(
            new ReorderTasksCommand(_workspaceId, _project.Id, new List<ReorderTaskItem>
            {
                new() { Id = clear.Id, Status = "Done", Position = 3 },
                new() { Id = blocked.Id, Status = "Done", Position = 4 },
            }),
            CancellationToken.None));

        // The guard throws before SaveChanges: even the unblocked row's
        // in-memory change is never committed.
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Reorder_SameColumnDrop_WhileBlocked_IsAllowed()
    {
        var blocked = Task(TaskItemStatus.Review);
        var blocker = Task(TaskItemStatus.InProgress, "Blocker");
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        var handler = new ReorderTasksCommandHandler(
            _taskItemRepository, _projectRepository, _unitOfWork, _dependencyRepository);

        await handler.Handle(
            new ReorderTasksCommand(_workspaceId, _project.Id, new List<ReorderTaskItem>
            {
                new() { Id = blocked.Id, Status = "Review", Position = 12 },
            }),
            CancellationToken.None);

        Assert.Equal(12, blocked.Position);
        Assert.Equal(TaskItemStatus.Review, blocked.Status);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    // ----- bulk move -----

    [Fact]
    public async Task BulkMove_WhileBlocked_IsRejected_WithBlockerNames()
    {
        var blocked = Task(TaskItemStatus.Ready, "Blocked task");
        var blocker = Task(TaskItemStatus.Planning, "Missing spec");
        _taskItemRepository.GetByIdAsync(blocked.Id, Arg.Any<CancellationToken>()).Returns(blocked);
        WithEdges(TaskDependency.Create(blocked.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(blocked.Id, blocked.Title, blocked.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        var handler = new BulkMoveTasksHandler(_taskItemRepository, _unitOfWork, _dependencyRepository);

        var ex = await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(
            new BulkMoveTasksCommand(_workspaceId, _project.Id, new List<Guid> { blocked.Id }, TaskItemStatus.Done),
            CancellationToken.None));

        Assert.Contains("Blocked task", ex.Message);
        Assert.Contains("Missing spec", ex.Message);
        Assert.Equal(TaskItemStatus.Ready, blocked.Status);
        await _unitOfWork.DidNotReceive().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BulkMove_SameStatusAsCurrent_IsNotGuarded()
    {
        var alreadyThere = Task(TaskItemStatus.Idea);
        var blocker = Task(TaskItemStatus.InProgress, "Blocker");
        _taskItemRepository.GetByIdAsync(alreadyThere.Id, Arg.Any<CancellationToken>()).Returns(alreadyThere);
        WithEdges(TaskDependency.Create(alreadyThere.Id, blocker.Id));
        WithSnapshots(
            new TaskStatusSnapshot(alreadyThere.Id, alreadyThere.Title, alreadyThere.Status),
            new TaskStatusSnapshot(blocker.Id, blocker.Title, blocker.Status));

        var handler = new BulkMoveTasksHandler(_taskItemRepository, _unitOfWork, _dependencyRepository);
        var count = await handler.Handle(
            new BulkMoveTasksCommand(_workspaceId, _project.Id, new List<Guid> { alreadyThere.Id }, TaskItemStatus.Idea),
            CancellationToken.None);

        Assert.Equal(1, count); // existing no-op semantics preserved
    }

    [Fact]
    public async Task BulkMove_EmptySelection_LoadsNoEdges()
    {
        var handler = new BulkMoveTasksHandler(_taskItemRepository, _unitOfWork, _dependencyRepository);
        var count = await handler.Handle(
            new BulkMoveTasksCommand(_workspaceId, _project.Id, new List<Guid>(), TaskItemStatus.Done),
            CancellationToken.None);

        Assert.Equal(0, count);
        await _dependencyRepository.DidNotReceive()
            .GetAllByProjectIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}
