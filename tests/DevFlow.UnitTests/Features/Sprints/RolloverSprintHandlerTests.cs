using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints.Rollover;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class RolloverSprintHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public RolloverSprintHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Rollover_ShouldMoveIncompleteTasksToNextPlannedSprint()
    {
        var completedSprint = Sprint.Create(_project.Id, "Sprint 1", "Goal");
        completedSprint.Start(DateTimeOffset.UtcNow.AddDays(-14), DateTimeOffset.UtcNow);
        completedSprint.Complete();

        var nextSprint = Sprint.Create(_project.Id, "Sprint 2", "Next");

        var task1 = TaskItem.Create(_project.Id, "Done task", null, TaskItemPriority.Medium);
        task1.ChangeStatus(TaskItemStatus.Done);
        task1.AssignToSprint(completedSprint.Id);

        var task2 = TaskItem.Create(_project.Id, "Incomplete task", null, TaskItemPriority.Medium);
        task2.AssignToSprint(completedSprint.Id);

        _sprintRepository.GetByIdAsync(completedSprint.Id, Arg.Any<CancellationToken>()).Returns(completedSprint);
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { completedSprint, nextSprint });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task1, task2 });

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(_workspaceId, _project.Id, completedSprint.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(1, result.RolledOverTasks);
        Assert.Equal(1, result.CompletedTasks);
        Assert.Equal(nextSprint.Id, result.TargetSprintId);
        await _activityLogRepository.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Target == "Incomplete task"),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Rollover_ShouldSendToBacklog_WhenNoPlannedSprint()
    {
        var completedSprint = Sprint.Create(_project.Id, "Sprint 1", "Goal");
        completedSprint.Start(DateTimeOffset.UtcNow.AddDays(-14), DateTimeOffset.UtcNow);
        completedSprint.Complete();

        var task = TaskItem.Create(_project.Id, "Lone task", null, TaskItemPriority.Medium);
        task.AssignToSprint(completedSprint.Id);

        _sprintRepository.GetByIdAsync(completedSprint.Id, Arg.Any<CancellationToken>()).Returns(completedSprint);
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { completedSprint });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(_workspaceId, _project.Id, completedSprint.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(1, result.RolledOverTasks);
        Assert.Null(result.TargetSprintId);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Rollover_ShouldNotMoveDoneTasks()
    {
        var completedSprint = Sprint.Create(_project.Id, "Sprint 1", "Goal");
        completedSprint.Start(DateTimeOffset.UtcNow.AddDays(-14), DateTimeOffset.UtcNow);
        completedSprint.Complete();

        var task = TaskItem.Create(_project.Id, "Done task", null, TaskItemPriority.Medium);
        task.ChangeStatus(TaskItemStatus.Done);
        task.AssignToSprint(completedSprint.Id);

        _sprintRepository.GetByIdAsync(completedSprint.Id, Arg.Any<CancellationToken>()).Returns(completedSprint);
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new[] { completedSprint });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(_workspaceId, _project.Id, completedSprint.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(0, result.RolledOverTasks);
        Assert.Equal(1, result.CompletedTasks);
        await _activityLogRepository.DidNotReceive().AddAsync(
            Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Rollover_ShouldReturnEmpty_WhenSprintNotCompleted()
    {
        var activeSprint = Sprint.Create(_project.Id, "Sprint 1", "Goal");
        activeSprint.Start(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(14));

        _sprintRepository.GetByIdAsync(activeSprint.Id, Arg.Any<CancellationToken>()).Returns(activeSprint);

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(_workspaceId, _project.Id, activeSprint.Id);

        var result = await handler.Handle(command, CancellationToken.None);

        Assert.Equal(0, result.RolledOverTasks);
        Assert.Equal(0, result.CompletedTasks);
        Assert.Null(result.TargetSprintId);
    }

    [Fact]
    public async Task Rollover_ShouldThrow_WhenProjectNotFound()
    {
        _projectRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Project?)null);

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Rollover_ShouldThrow_WhenSprintNotFound()
    {
        _sprintRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>()).Returns((Sprint?)null);

        var handler = new RolloverSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository,
            _activityLogRepository, _unitOfWork);
        var command = new RolloverSprintCommand(_workspaceId, Guid.NewGuid(), Guid.NewGuid());

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}