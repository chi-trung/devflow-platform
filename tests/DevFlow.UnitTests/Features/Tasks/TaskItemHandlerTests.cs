using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Application.Features.Tasks.Delete;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class TaskItemHandlerTests
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
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public TaskItemHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(_project);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    [Fact]
    public async Task Create_ShouldPersistTaskInBacklog()
    {
        var handler = new CreateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userContext, _unitOfWork);
        var command = new CreateTaskItemCommand(
            _workspaceId, _project.Id, "Design board layout", null, TaskItemPriority.High, null);

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(Guid.Empty, response.Id);
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(task =>
                task.Title == "Design board layout" &&
                task.Status == TaskItemStatus.Backlog &&
                task.Priority == TaskItemPriority.High),
            Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log =>
                log.Action == "created task" &&
                log.TaskItemId == response.Id &&
                log.ActorUserId == _userContext.UserId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectBelongsToAnotherWorkspace()
    {
        var handler = new CreateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userContext, _unitOfWork);
        var command = new CreateTaskItemCommand(
            Guid.NewGuid(), _project.Id, "Orphan task", null, TaskItemPriority.Medium, null);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ShouldRejectAssigneeOutsideWorkspace()
    {
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((WorkspaceRole?)null);

        var task = Domain.Entities.TaskItem.Create(_project.Id, "Existing", null, TaskItemPriority.Low);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _workspaceRepository, _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository, _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);
        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, task.Id, "Existing", null,
            TaskItemStatus.InProgress, TaskItemPriority.Low, Guid.NewGuid(), null);

        await Assert.ThrowsAsync<ValidationException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Update_ShouldApplyChanges_AndStampCompletionWhenDone()
    {
        var assigneeId = Guid.NewGuid();
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), assigneeId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);

        var task = Domain.Entities.TaskItem.Create(_project.Id, "Existing", null, TaskItemPriority.Low);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _workspaceRepository, _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository, _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);
        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, task.Id, "Updated title", "desc",
            TaskItemStatus.Done, TaskItemPriority.Critical, assigneeId, null);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Updated title", task.Title);
        Assert.Equal(TaskItemStatus.Done, task.Status);
        Assert.Equal(assigneeId, task.AssigneeId);
        Assert.NotNull(task.CompletedAtUtc);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_ShouldLogStatusChangeAndAssignment()
    {
        var assigneeId = Guid.NewGuid();
        _workspaceRepository.GetMemberRoleAsync(Arg.Any<Guid>(), assigneeId, Arg.Any<CancellationToken>())
            .Returns(WorkspaceRole.Member);
        _userRepository.GetByIdAsync(assigneeId, Arg.Any<CancellationToken>())
            .Returns(User.Create("assignee", "assignee@devflow.app", "password", "Assignee"));

        var task = Domain.Entities.TaskItem.Create(_project.Id, "Existing", null, TaskItemPriority.Low);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _workspaceRepository, _userRepository, _notificationRepository, _preferencesRepository, _watcherRepository, _emailService, _realtimeService, _activityLogRepository, _userContext, _unitOfWork);
        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, task.Id, "Existing", null,
            TaskItemStatus.InProgress, TaskItemPriority.Low, assigneeId, null);

        await handler.Handle(command, CancellationToken.None);

        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Action == "moved task to" && log.Target == "InProgress"),
            Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Action == "assigned task to"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldRemoveTask()
    {
        var task = Domain.Entities.TaskItem.Create(_project.Id, "Doomed", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new DeleteTaskItemCommandHandler(
            _projectRepository, _taskItemRepository, _activityLogRepository, _userContext, _unitOfWork);
        var command = new DeleteTaskItemCommand(_workspaceId, _project.Id, task.Id);

        await handler.Handle(command, CancellationToken.None);

        await _taskItemRepository.Received(1).RemoveAsync(task, Arg.Any<CancellationToken>());
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log =>
                log.Action == "deleted task" &&
                log.TaskItemId == task.Id &&
                log.ActorUserId == _userContext.UserId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
