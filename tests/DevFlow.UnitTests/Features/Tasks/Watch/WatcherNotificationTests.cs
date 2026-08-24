using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Comments.Create;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Watch;

public class WatcherNotificationTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ICommentRepository _commentRepository = Substitute.For<ICommentRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly ITaskWatcherRepository _watcherRepository = Substitute.For<ITaskWatcherRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IRealtimeNotificationService _realtimeService = Substitute.For<IRealtimeNotificationService>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();
    private readonly Guid _watcherId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public WatcherNotificationTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Watched task", null, TaskItemPriority.High);
        _userContext.UserId.Returns(_actorId);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _watcherRepository.GetByTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { TaskWatcher.Create(_task.Id, _watcherId) });
    }

    [Fact]
    public async Task Comment_ShouldNotifyWatcher()
    {
        var handler = new CreateCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository,
            _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);

        await handler.Handle(
            new CreateCommentCommand(_workspaceId, _project.Id, _task.Id, "Nice work!"),
            CancellationToken.None);

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == _watcherId &&
                n.Type == "TaskUpdate" &&
                n.TaskItemId == _task.Id),
            Arg.Any<CancellationToken>());

        await _realtimeService.Received(1).NotifyUserAsync(
            _watcherId,
            "TaskUpdate",
            Arg.Any<string>(),
            _task.Id,
            _project.Id,
            _workspaceId,
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Comment_ShouldSkipWatcher_WhenWatcherIsTheActor()
    {
        _watcherRepository.GetByTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { TaskWatcher.Create(_task.Id, _actorId) });

        var handler = new CreateCommentCommandHandler(
            _projectRepository, _taskItemRepository, _commentRepository,
            _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository,
            _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);

        await handler.Handle(
            new CreateCommentCommand(_workspaceId, _project.Id, _task.Id, "Self comment"),
            CancellationToken.None);

        await _notificationRepository.DidNotReceive().AddAsync(
            Arg.Is<Notification>(n => n.Type == "TaskUpdate"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatusChange_ShouldNotifyWatcher()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _workspaceRepository,
            _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository,
            _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);

        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, _task.Id, "Watched task", null,
            TaskItemStatus.InProgress, TaskItemPriority.High, null, null);

        await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == _watcherId &&
                n.Type == "TaskUpdate" &&
                n.Message.Contains("status changed")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task StatusChange_ShouldNotNotify_WhenNothingChanged()
    {
        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _workspaceRepository,
            _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository,
            _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);

        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, _task.Id, "Watched task", null,
            TaskItemStatus.Backlog, TaskItemPriority.High, null, null);

        await handler.Handle(command, CancellationToken.None);

        await _notificationRepository.DidNotReceive().AddAsync(
            Arg.Is<Notification>(n => n.Type == "TaskUpdate"),
            Arg.Any<CancellationToken>());
    }
}
