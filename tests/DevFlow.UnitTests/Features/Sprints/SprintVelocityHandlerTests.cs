using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Sprints.Velocity;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class SprintVelocityHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly Sprint _sprint;

    public SprintVelocityHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _sprint = Sprint.Create(_project.Id, "Sprint 18", "Hierarchy");
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _sprintRepository.GetByIdAsync(_sprint.Id, Arg.Any<CancellationToken>()).Returns(_sprint);
    }

    [Fact]
    public async Task Velocity_ShouldAggregateStoryPointsForSprintOnly()
    {
        var inSprintDone = TaskItem.Create(_project.Id, "A", null, TaskItemPriority.Medium);
        inSprintDone.AssignToSprint(_sprint.Id);
        inSprintDone.SetStoryPoints(5);
        inSprintDone.ChangeStatus(TaskItemStatus.Done);

        var inSprintOpen = TaskItem.Create(_project.Id, "B", null, TaskItemPriority.Medium);
        inSprintOpen.AssignToSprint(_sprint.Id);
        inSprintOpen.SetStoryPoints(3);

        var backlogTask = TaskItem.Create(_project.Id, "C", null, TaskItemPriority.Low);
        backlogTask.SetStoryPoints(13);

        _taskItemRepository.GetForProjectAsync(_project.Id, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { inSprintDone, inSprintOpen, backlogTask });

        var handler = new GetSprintVelocityQueryHandler(
            _projectRepository, _sprintRepository, _taskItemRepository);
        var result = await handler.Handle(
            new GetSprintVelocityQuery(_workspaceId, _project.Id, _sprint.Id),
            CancellationToken.None);

        Assert.Equal(2, result.TotalTasks);
        Assert.Equal(1, result.CompletedTasks);
        Assert.Equal(8, result.TotalStoryPoints);
        Assert.Equal(5, result.CompletedStoryPoints);
        Assert.Equal(50, result.CompletionPercent);
    }

    [Fact]
    public async Task Velocity_ShouldThrowNotFound_WhenSprintInOtherProject()
    {
        var foreignSprint = Sprint.Create(Guid.NewGuid(), "Foreign", null);
        _sprintRepository.GetByIdAsync(foreignSprint.Id, Arg.Any<CancellationToken>()).Returns(foreignSprint);

        var handler = new GetSprintVelocityQueryHandler(
            _projectRepository, _sprintRepository, _taskItemRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new GetSprintVelocityQuery(_workspaceId, _project.Id, foreignSprint.Id),
            CancellationToken.None));
    }
}
