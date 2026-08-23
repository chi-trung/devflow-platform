using System.Reflection;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Reporting;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Reporting;

public class CycleLeadTimeHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task CycleLeadTime_ShouldComputeP50P90()
    {
        var created = DateTimeOffset.UtcNow.AddDays(-20);
        var tasks = new[]
        {
            MakeDone("A", created, created.AddDays(1), created.AddDays(3)),   // cycle 2, lead 3
            MakeDone("B", created, created.AddDays(1), created.AddDays(5)),   // cycle 4, lead 5
            MakeDone("C", created, created.AddDays(1), created.AddDays(9)),   // cycle 8, lead 9
            MakeDone("D", created, created.AddDays(1), created.AddDays(17)),  // cycle 16, lead 17
        };

        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(tasks);

        var handler = new GetCycleLeadTimeHandler(_taskItemRepository);
        var result = await handler.Handle(
            new GetCycleLeadTimeQuery(_workspaceId, _projectId),
            CancellationToken.None);

        // sorted cycle values [2,4,8,16]; P50 index 1.5 -> 6; P90 index 2.7 -> 13.6
        Assert.Equal(6.0, result.CycleTimeP50);
        Assert.Equal(13.6, result.CycleTimeP90);
        // sorted lead values [3,5,9,17]; P50 index 1.5 -> 7; P90 index 2.7 -> 14.6
        Assert.Equal(7.0, result.LeadTimeP50);
        Assert.Equal(14.6, result.LeadTimeP90);
        Assert.Equal(4, result.Tasks.Count);
    }

    [Fact]
    public async Task CycleLeadTime_ShouldFallBackToCreatedAt_WhenStartedAtMissing()
    {
        var created = DateTimeOffset.UtcNow.AddDays(-10);
        var task = MakeDone("A", created, started: null, completed: created.AddDays(4));

        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = new GetCycleLeadTimeHandler(_taskItemRepository);
        var result = await handler.Handle(
            new GetCycleLeadTimeQuery(_workspaceId, _projectId),
            CancellationToken.None);

        // cycle time = completed - created (fallback) = 4 days
        var cycle = Assert.Single(result.Tasks);
        Assert.Equal(4.0, cycle.CycleTimeDays);
        Assert.Equal(4.0, result.CycleTimeP50);
    }

    [Fact]
    public async Task CycleLeadTime_ShouldSkipNotDoneTasks()
    {
        var created = DateTimeOffset.UtcNow.AddDays(-5);
        var done = MakeDone("Done", created, created.AddDays(1), created.AddDays(3));
        var open = TaskItem.Create(_projectId, "Open", null, TaskItemPriority.Medium);
        open.ChangeStatus(TaskItemStatus.InProgress);

        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { done, open });

        var handler = new GetCycleLeadTimeHandler(_taskItemRepository);
        var result = await handler.Handle(
            new GetCycleLeadTimeQuery(_workspaceId, _projectId),
            CancellationToken.None);

        Assert.Single(result.Tasks);
        Assert.Equal("Done", result.Tasks[0].Title);
    }

    [Fact]
    public async Task CycleLeadTime_ShouldReturnNullPercentiles_WhenNoDoneTasks()
    {
        var open = TaskItem.Create(_projectId, "Open", null, TaskItemPriority.Low);

        _taskItemRepository.GetForProjectAsync(_projectId, (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(new[] { open });

        var handler = new GetCycleLeadTimeHandler(_taskItemRepository);
        var result = await handler.Handle(
            new GetCycleLeadTimeQuery(_workspaceId, _projectId),
            CancellationToken.None);

        Assert.Null(result.CycleTimeP50);
        Assert.Null(result.LeadTimeP50);
        Assert.Empty(result.Tasks);
    }

    private static TaskItem MakeDone(
        string title,
        DateTimeOffset created,
        DateTimeOffset? started,
        DateTimeOffset completed)
    {
        var task = TaskItem.Create(Guid.NewGuid(), title, null, TaskItemPriority.Medium);

        typeof(TaskItem).GetProperty(nameof(TaskItem.CreatedAtUtc))!
            .SetValue(task, created);
        typeof(TaskItem).GetProperty(nameof(TaskItem.CompletedAtUtc))!
            .SetValue(task, completed);
        typeof(TaskItem).GetProperty(nameof(TaskItem.Status))!
            .SetValue(task, TaskItemStatus.Done);

        if (started.HasValue)
        {
            typeof(TaskItem).GetProperty(nameof(TaskItem.StartedAtUtc))!
                .SetValue(task, started.Value);
        }

        return task;
    }
}
