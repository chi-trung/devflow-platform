using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints.Delete;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class DeleteSprintCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public DeleteSprintCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Fact]
    public async Task Delete_ShouldRemoveSprint_AndMoveTasksToBacklog()
    {
        var sprint = Sprint.Create(_project.Id, "Sprint 1", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var taskA = TaskItem.Create(_project.Id, "Task A", null, TaskItemPriority.High);
        taskA.AssignToSprint(sprint.Id);
        var taskB = TaskItem.Create(_project.Id, "Task B", null, TaskItemPriority.Medium);
        taskB.AssignToSprint(sprint.Id);

        _taskItemRepository.GetForSprintAsync(sprint.Id, Arg.Any<CancellationToken>())
            .Returns([taskA, taskB]);

        var handler = new DeleteSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);

        await handler.Handle(new DeleteSprintCommand(_workspaceId, _project.Id, sprint.Id), CancellationToken.None);

        // Tasks are detached back to the backlog.
        Assert.Null(taskA.SprintId);
        Assert.Null(taskB.SprintId);

        await _sprintRepository.Received(1).RemoveAsync(sprint, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenSprintBelongsToDifferentProject()
    {
        var otherProject = Project.Create(Guid.NewGuid(), "Other", "OTH", null);
        var sprint = Sprint.Create(otherProject.Id, "Foreign sprint", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new DeleteSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new DeleteSprintCommand(_workspaceId, _project.Id, sprint.Id), CancellationToken.None));

        await _sprintRepository.DidNotReceive().RemoveAsync(Arg.Any<Sprint>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenSprintDoesNotExist()
    {
        var missingId = Guid.NewGuid();
        _sprintRepository.GetByIdAsync(missingId, Arg.Any<CancellationToken>()).Returns((Sprint?)null);

        var handler = new DeleteSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new DeleteSprintCommand(_workspaceId, _project.Id, missingId), CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenProjectBelongsToDifferentWorkspace()
    {
        var foreignWorkspace = Guid.NewGuid();
        var foreignProject = Project.Create(foreignWorkspace, "Foreign", "FRG", null);
        _projectRepository.GetByIdAsync(foreignProject.Id, Arg.Any<CancellationToken>()).Returns(foreignProject);

        var sprint = Sprint.Create(foreignProject.Id, "Sprint 1", null);
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>()).Returns(sprint);

        var handler = new DeleteSprintCommandHandler(
            _projectRepository, _sprintRepository, _taskItemRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            handler.Handle(new DeleteSprintCommand(_workspaceId, foreignProject.Id, sprint.Id), CancellationToken.None));
    }
}
