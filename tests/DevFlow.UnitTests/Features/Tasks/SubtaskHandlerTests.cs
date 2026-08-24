using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Tasks.Subtasks;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class SubtaskHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly IRealtimeNotificationService _realtimeService = Substitute.For<IRealtimeNotificationService>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public SubtaskHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task CreateSubtask_ShouldAttachToParentAndInheritContext()
    {
        var parent = TaskItem.Create(_project.Id, "Parent", null, TaskItemPriority.High);
        var epicId = Guid.NewGuid();
        var sprintId = Guid.NewGuid();
        parent.AttachToEpic(epicId);
        parent.AssignToSprint(sprintId);

        _taskItemRepository.GetByIdAsync(parent.Id, Arg.Any<CancellationToken>()).Returns(parent);

        var handler = new CreateSubtaskCommandHandler(
            _projectRepository, _taskItemRepository, _unitOfWork);
        var command = new CreateSubtaskCommand(
            _workspaceId, _project.Id, parent.Id, "Write migration", null, TaskItemPriority.Medium);

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(parent.Id, response.ParentTaskId);
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(task =>
                task.ParentTaskId == parent.Id
                && task.EpicId == epicId
                && task.SprintId == sprintId),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtask_ShouldRejectNestedSubtask()
    {
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var child = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        child.AttachToParent(root.Id);

        _taskItemRepository.GetByIdAsync(child.Id, Arg.Any<CancellationToken>()).Returns(child);

        var handler = new CreateSubtaskCommandHandler(
            _projectRepository, _taskItemRepository, _unitOfWork);
        var command = new CreateSubtaskCommand(
            _workspaceId, _project.Id, child.Id, "Grandchild", null, TaskItemPriority.Low);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Detach_ShouldRejectWhenNotASubtaskOfParent()
    {
        var parent = TaskItem.Create(_project.Id, "Parent", null, TaskItemPriority.Medium);
        var other = TaskItem.Create(_project.Id, "Other", null, TaskItemPriority.Medium);
        other.AttachToParent(Guid.NewGuid());

        _taskItemRepository.GetByIdAsync(parent.Id, Arg.Any<CancellationToken>()).Returns(parent);
        _taskItemRepository.GetByIdAsync(other.Id, Arg.Any<CancellationToken>()).Returns(other);

        var handler = new DetachSubtaskCommandHandler(
            _projectRepository, _taskItemRepository, _unitOfWork);
        var command = new DetachSubtaskCommand(_workspaceId, _project.Id, parent.Id, other.Id);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task CompletingLastOpenSubtask_ShouldCompleteParent()
    {
        var parent = TaskItem.Create(_project.Id, "Parent", null, TaskItemPriority.Medium);
        var first = TaskItem.Create(_project.Id, "First", null, TaskItemPriority.Medium);
        var last = TaskItem.Create(_project.Id, "Last", null, TaskItemPriority.Medium);
        first.AttachToParent(parent.Id);
        last.AttachToParent(parent.Id);
        first.ChangeStatus(TaskItemStatus.Done);

        // The update flow loads the tracked subtask...
        _taskItemRepository.GetByIdAsync(last.Id, Arg.Any<CancellationToken>()).Returns(last);
        // ...and identity resolution must observe its in-memory Done status.
        _taskItemRepository.GetSubtasksAsync(parent.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { first, last });
        _taskItemRepository.GetByIdAsync(parent.Id, Arg.Any<CancellationToken>()).Returns(parent);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository,
            _taskItemRepository,
            _workspaceRepository,
            _userRepository,
            _notificationRepository,
            _preferencesRepository,
            _emailService,
            _realtimeService,
            _unitOfWork);

        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, last.Id,
            "Last", null, TaskItemStatus.Done, TaskItemPriority.Medium, null, null);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal(TaskItemStatus.Done, parent.Status);
        Assert.NotNull(parent.CompletedAtUtc);
    }

    [Fact]
    public async Task CompletingSubtask_ShouldNotCompleteParent_WhenSiblingsStillOpen()
    {
        var parent = TaskItem.Create(_project.Id, "Parent", null, TaskItemPriority.Medium);
        var openSibling = TaskItem.Create(_project.Id, "Open sibling", null, TaskItemPriority.Medium);
        var completing = TaskItem.Create(_project.Id, "Completing", null, TaskItemPriority.Medium);
        openSibling.AttachToParent(parent.Id);
        completing.AttachToParent(parent.Id);

        _taskItemRepository.GetByIdAsync(completing.Id, Arg.Any<CancellationToken>()).Returns(completing);
        _taskItemRepository.GetSubtasksAsync(parent.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { openSibling, completing });
        _taskItemRepository.GetByIdAsync(parent.Id, Arg.Any<CancellationToken>()).Returns(parent);

        var handler = new UpdateTaskItemCommandHandler(
            _projectRepository,
            _taskItemRepository,
            _workspaceRepository,
            _userRepository,
            _notificationRepository,
            _preferencesRepository,
            _emailService,
            _realtimeService,
            _unitOfWork);

        var command = new UpdateTaskItemCommand(
            _workspaceId, _project.Id, completing.Id,
            "Completing", null, TaskItemStatus.Done, TaskItemPriority.Medium, null, null);

        await handler.Handle(command, CancellationToken.None);

        Assert.NotEqual(TaskItemStatus.Done, parent.Status);
    }
}
