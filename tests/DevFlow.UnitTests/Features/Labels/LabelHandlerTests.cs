using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Labels;
using DevFlow.Domain.Entities;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Labels;

public class LabelHandlerTests
{
    private readonly ILabelRepository _labelRepository = Substitute.For<ILabelRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    public LabelHandlerTests()
    {
        // Default: the route's project lives in the claimed workspace.
        // Cross-workspace rejection tests override this stub.
        _projectRepository
            .GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Project.Create(_workspaceId, "DevFlow", "DEV", null));
    }

    [Fact]
    public async Task Create_ShouldPersistLabel()
    {
        _labelRepository.ExistsByNameInProjectAsync(_projectId, "Bug", Arg.Any<CancellationToken>()).Returns(false);

        var handler = new CreateLabelHandler(_labelRepository, _projectRepository, _unitOfWork);
        var result = await handler.Handle(
            new CreateLabelCommand(_workspaceId, _projectId, "Bug", "#f87171"), CancellationToken.None);

        Assert.Equal("Bug", result.Name);
        Assert.Equal("#f87171", result.Color);
        await _labelRepository.Received(1).AddAsync(Arg.Any<Label>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowConflict_WhenNameExists()
    {
        _labelRepository.ExistsByNameInProjectAsync(_projectId, "Bug", Arg.Any<CancellationToken>()).Returns(true);

        var handler = new CreateLabelHandler(_labelRepository, _projectRepository, _unitOfWork);

        await Assert.ThrowsAsync<ConflictException>(
            () => handler.Handle(
                new CreateLabelCommand(_workspaceId, _projectId, "Bug", "#f87171"), CancellationToken.None));
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectInOtherWorkspace()
    {
        var handler = new CreateLabelHandler(_labelRepository, _projectRepository, _unitOfWork);

        // WorkspaceAuthorizationBehavior proved membership of _workspaceId,
        // but the project belongs to someone else's workspace — the handler
        // must not create a label inside it.
        _projectRepository
            .GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Project.Create(Guid.NewGuid(), "Foreign", "FRN", null));

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(
                new CreateLabelCommand(_workspaceId, _projectId, "Bug", "#f87171"), CancellationToken.None));
        await _labelRepository.DidNotReceive().AddAsync(Arg.Any<Label>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldRemoveLabel()
    {
        var label = Label.Create(_projectId, "Bug", "#f87171");
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new DeleteLabelHandler(_labelRepository, _projectRepository, _unitOfWork);
        await handler.Handle(
            new DeleteLabelCommand(_workspaceId, _projectId, label.Id), CancellationToken.None);

        await _labelRepository.Received(1).RemoveAsync(label, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenLabelInOtherProject()
    {
        var label = Label.Create(Guid.NewGuid(), "Other", "#000000");
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new DeleteLabelHandler(_labelRepository, _projectRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(
                new DeleteLabelCommand(_workspaceId, _projectId, label.Id), CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldReturnProjectLabels()
    {
        var labels = new[] { Label.Create(_projectId, "Bug", "#f87171"), Label.Create(_projectId, "Feature", "#2dd4bf") };
        _labelRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>()).Returns(labels);

        var handler = new GetLabelsHandler(_labelRepository, _projectRepository);
        var result = await handler.Handle(
            new GetLabelsQuery(_workspaceId, _projectId), CancellationToken.None);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, l => l.Name == "Bug");
    }

    [Fact]
    public async Task List_ShouldThrowNotFound_WhenProjectInOtherWorkspace()
    {
        _projectRepository
            .GetByIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(Project.Create(Guid.NewGuid(), "Foreign", "FRN", null));

        var handler = new GetLabelsHandler(_labelRepository, _projectRepository);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(new GetLabelsQuery(_workspaceId, _projectId), CancellationToken.None));
        await _labelRepository.DidNotReceive().GetForProjectAsync(_projectId, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Assign_ShouldPersistTaskLabel_WhenTaskAndLabelBothInProject()
    {
        var label = Label.Create(_projectId, "Bug", "#f87171");
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);
        _taskItemRepository
            .GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(TaskItem.Create(_projectId, "Task", null, DevFlow.Domain.Enums.TaskItemPriority.Medium));

        var handler = new AssignLabelToTaskHandler(
            _labelRepository, _taskItemRepository, _projectRepository, _unitOfWork);
        await handler.Handle(
            new AssignLabelToTaskCommand(_workspaceId, _projectId, Guid.NewGuid(), label.Id),
            CancellationToken.None);

        await _labelRepository.Received(1)
            .AddTaskLabelAsync(Arg.Any<TaskLabel>(), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Assign_ShouldThrowNotFound_WhenTaskInOtherProject()
    {
        var foreignTask = TaskItem.Create(Guid.NewGuid(), "Foreign task", null, DevFlow.Domain.Enums.TaskItemPriority.Medium);
        var label = Label.Create(_projectId, "Bug", "#f87171");
        _taskItemRepository.GetByIdAsync(foreignTask.Id, Arg.Any<CancellationToken>()).Returns(foreignTask);
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new AssignLabelToTaskHandler(
            _labelRepository, _taskItemRepository, _projectRepository, _unitOfWork);

        // The forged task+label pair used to insert a TaskLabel row that
        // leaked this project's label id into the foreign task's board
        // payload via the labelIds join.
        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(
                new AssignLabelToTaskCommand(_workspaceId, _projectId, foreignTask.Id, label.Id),
                CancellationToken.None));
        await _labelRepository.DidNotReceive()
            .AddTaskLabelAsync(Arg.Any<TaskLabel>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Assign_ShouldThrowNotFound_WhenLabelInOtherProject()
    {
        var foreignLabel = Label.Create(Guid.NewGuid(), "Other", "#000000");
        _labelRepository.GetByIdAsync(foreignLabel.Id, Arg.Any<CancellationToken>()).Returns(foreignLabel);
        _taskItemRepository
            .GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(TaskItem.Create(_projectId, "Task", null, DevFlow.Domain.Enums.TaskItemPriority.Medium));

        var handler = new AssignLabelToTaskHandler(
            _labelRepository, _taskItemRepository, _projectRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(
                new AssignLabelToTaskCommand(_workspaceId, _projectId, Guid.NewGuid(), foreignLabel.Id),
                CancellationToken.None));
        await _labelRepository.DidNotReceive()
            .AddTaskLabelAsync(Arg.Any<TaskLabel>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Remove_ShouldDeleteTaskLabel_WhenTaskAndLabelBothInProject()
    {
        var label = Label.Create(_projectId, "Bug", "#f87171");
        var task = TaskItem.Create(_projectId, "Task", null, DevFlow.Domain.Enums.TaskItemPriority.Medium);
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new RemoveLabelFromTaskHandler(
            _labelRepository, _taskItemRepository, _projectRepository, _unitOfWork);
        await handler.Handle(
            new RemoveLabelFromTaskCommand(_workspaceId, _projectId, task.Id, label.Id),
            CancellationToken.None);

        await _labelRepository.Received(1)
            .RemoveTaskLabelAsync(task.Id, label.Id, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Remove_ShouldThrowNotFound_WhenTaskInOtherProject()
    {
        var foreignTask = TaskItem.Create(Guid.NewGuid(), "Foreign task", null, DevFlow.Domain.Enums.TaskItemPriority.Medium);
        var label = Label.Create(_projectId, "Bug", "#f87171");
        _taskItemRepository.GetByIdAsync(foreignTask.Id, Arg.Any<CancellationToken>()).Returns(foreignTask);
        _labelRepository.GetByIdAsync(label.Id, Arg.Any<CancellationToken>()).Returns(label);

        var handler = new RemoveLabelFromTaskHandler(
            _labelRepository, _taskItemRepository, _projectRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(
            () => handler.Handle(
                new RemoveLabelFromTaskCommand(_workspaceId, _projectId, foreignTask.Id, label.Id),
                CancellationToken.None));
        await _labelRepository.DidNotReceive()
            .RemoveTaskLabelAsync(Arg.Any<Guid>(), Arg.Any<Guid>(), Arg.Any<CancellationToken>());
    }
}
