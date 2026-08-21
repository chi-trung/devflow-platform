using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints.AssignTask;
using DevFlow.Application.Features.Sprints.Complete;
using DevFlow.Application.Features.Sprints.Create;
using DevFlow.Application.Features.Sprints.RemoveTask;
using DevFlow.Application.Features.Sprints.Start;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class SprintHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public SprintHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Create_ShouldPersistPlannedSprint()
    {
        var handler = new CreateSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new CreateSprintCommand(_workspaceId, _project.Id, "Sprint 1", "Ship the board");

        var response = await handler.Handle(command, CancellationToken.None);

        Assert.Equal("Planned", response.Status);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Start_ShouldThrowConflict_WhenAnotherSprintIsActive()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 2", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);
        _sprintRepository.HasActiveSprintAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(true);

        var handler = new StartSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new StartSprintCommand(
            _workspaceId, _project.Id, sprint.Id,
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(14));

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Start_ShouldRejectEndDateBeforeStartDate()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);
        _sprintRepository.HasActiveSprintAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(false);

        var handler = new StartSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new StartSprintCommand(
            _workspaceId, _project.Id, sprint.Id,
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(-1));

        await Assert.ThrowsAsync<ArgumentException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task Complete_ShouldStampCompletionTime()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", null);
        sprint.Start(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(14));
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new CompleteSprintCommandHandler(_projectRepository, _sprintRepository, _unitOfWork);
        var command = new CompleteSprintCommand(_workspaceId, _project.Id, sprint.Id);

        await handler.Handle(command, CancellationToken.None);

        Assert.Equal(SprintStatus.Completed, sprint.Status);
        Assert.NotNull(sprint.CompletedAtUtc);
    }

    [Fact]
    public async Task AssignTask_ShouldRejectCompletedSprint()
    {
        var sprint = Sprint.Create(_project.Id, "Old sprint", null);
        sprint.Start(DateTimeOffset.UtcNow.AddDays(-20), DateTimeOffset.UtcNow.AddDays(-6));
        sprint.Complete();
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var task = TaskItem.Create(_project.Id, "A task", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new AssignTaskToSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);
        var command = new AssignTaskToSprintCommand(_workspaceId, _project.Id, sprint.Id, task.Id);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task RemoveTask_ShouldThrowNotFound_WhenTaskIsInDifferentSprint()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var task = TaskItem.Create(_project.Id, "A task", null, TaskItemPriority.Medium);
        task.AssignToSprint(Guid.NewGuid());
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new RemoveTaskFromSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);
        var command = new RemoveTaskFromSprintCommand(_workspaceId, _project.Id, sprint.Id, task.Id);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(command, CancellationToken.None));
    }
}
