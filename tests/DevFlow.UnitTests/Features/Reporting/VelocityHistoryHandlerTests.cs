using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Reporting;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Reporting;

public class VelocityHistoryHandlerTests
{
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ICacheService _cacheService = Substitute.For<ICacheService>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    public VelocityHistoryHandlerTests()
    {
        _cacheService.GetOrSetAsync<VelocityHistoryResponse>(
                Arg.Any<string>(), Arg.Any<Func<CancellationToken, Task<VelocityHistoryResponse>>>(),
                Arg.Any<TimeSpan?>(), Arg.Any<IEnumerable<string>?>(), Arg.Any<CancellationToken>())
            .Returns(callInfo => callInfo.ArgAt<Func<CancellationToken, Task<VelocityHistoryResponse>>>(1)(CancellationToken.None));
    }

    [Fact]
    public async Task VelocityHistory_ShouldAggregateStoryPointsPerSprint()
    {
        var sprint1 = Sprint.Create(_projectId, "Sprint 1", null);
        sprint1.Start(DateTimeOffset.UtcNow.AddDays(-30), DateTimeOffset.UtcNow.AddDays(-20));

        var sprint2 = Sprint.Create(_projectId, "Sprint 2", null);
        sprint2.Start(DateTimeOffset.UtcNow.AddDays(-15), DateTimeOffset.UtcNow.AddDays(-5));

        var done1 = TaskItem.Create(_projectId, "A", null, TaskItemPriority.Medium);
        done1.AssignToSprint(sprint1.Id);
        done1.SetStoryPoints(5);
        done1.ChangeStatus(TaskItemStatus.Done);

        var open1 = TaskItem.Create(_projectId, "B", null, TaskItemPriority.Medium);
        open1.AssignToSprint(sprint1.Id);
        open1.SetStoryPoints(3);

        var done2 = TaskItem.Create(_projectId, "C", null, TaskItemPriority.Medium);
        done2.AssignToSprint(sprint2.Id);
        done2.SetStoryPoints(8);
        done2.ChangeStatus(TaskItemStatus.Done);

        var backlog = TaskItem.Create(_projectId, "D", null, TaskItemPriority.Low);
        backlog.SetStoryPoints(13);

        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { sprint1, sprint2 });
        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { done1, open1, done2, backlog });

        var handler = new GetVelocityHistoryHandler(_sprintRepository, _taskItemRepository, _cacheService);
        var result = await handler.Handle(
            new GetVelocityHistoryQuery(_workspaceId, _projectId),
            CancellationToken.None);

        Assert.Equal(2, result.Points.Count);

        var first = result.Points.First(p => p.SprintId == sprint1.Id);
        Assert.Equal(8, first.TotalStoryPoints);
        Assert.Equal(5, first.CompletedStoryPoints);

        var second = result.Points.First(p => p.SprintId == sprint2.Id);
        Assert.Equal(8, second.TotalStoryPoints);
        Assert.Equal(8, second.CompletedStoryPoints);

        Assert.Equal(6.5, result.AverageCompleted);
        Assert.Equal(8.0, result.AverageTotal);
    }

    [Fact]
    public async Task VelocityHistory_ShouldOnlyIncludeSprintsWithStartDate()
    {
        var scheduled = Sprint.Create(_projectId, "Scheduled", null);
        scheduled.Start(DateTimeOffset.UtcNow.AddDays(-10), DateTimeOffset.UtcNow.AddDays(-3));

        var unscheduled = Sprint.Create(_projectId, "Draft", null);

        _sprintRepository.GetForProjectAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new[] { scheduled, unscheduled });
        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<TaskItem>());

        var handler = new GetVelocityHistoryHandler(_sprintRepository, _taskItemRepository, _cacheService);
        var result = await handler.Handle(
            new GetVelocityHistoryQuery(_workspaceId, _projectId),
            CancellationToken.None);

        var point = Assert.Single(result.Points);
        Assert.Equal("Scheduled", point.SprintName);
    }
}
