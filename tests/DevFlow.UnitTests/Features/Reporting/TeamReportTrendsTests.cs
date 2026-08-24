using System.Reflection;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Reporting;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Reporting;

public class TeamReportTrendsTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITimeEntryRepository _timeEntryRepository = Substitute.For<ITimeEntryRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _memberId = Guid.NewGuid();

    [Fact]
    public async Task Trends_ShouldReturnNeutral_WhenNoDateRangeProvided()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { (UserId: _memberId, Email: "a@x.io", Username: "a", DisplayName: "A", Role: WorkspaceRole.Member) });
        _taskItemRepository.GetByAssigneeIdAsync(_memberId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());
        _timeEntryRepository.GetTotalMinutesByUserIdAsync(_memberId, Arg.Any<CancellationToken>())
            .Returns(0);

        var handler = new GetTeamReportHandler(_workspaceRepository, _taskItemRepository, _timeEntryRepository);
        var result = await handler.Handle(new GetTeamReportQuery(_workspaceId), CancellationToken.None);

        Assert.Equal(0, result.Trends.CompletedDelta);
        Assert.Null(result.Trends.CycleTimeDelta);
    }

    [Fact]
    public async Task Trends_ShouldComputeCompletedDelta_AcrossWindows()
    {
        var start = DateTimeOffset.UtcNow.AddDays(-10);
        var end = DateTimeOffset.UtcNow;

        var currentTask = DoneTask("Current", started: start.AddDays(1), completed: start.AddDays(2));
        var previousTask = DoneTask("Previous", started: start.AddDays(-9), completed: start.AddDays(-8));

        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { (UserId: _memberId, Email: "a@x.io", Username: "a", DisplayName: "A", Role: WorkspaceRole.Member) });
        _taskItemRepository.GetByAssigneeIdAsync(_memberId, Arg.Any<CancellationToken>())
            .Returns(new[] { currentTask, previousTask });
        _timeEntryRepository.GetTotalMinutesByUserIdAsync(_memberId, Arg.Any<CancellationToken>())
            .Returns(0);

        var handler = new GetTeamReportHandler(_workspaceRepository, _taskItemRepository, _timeEntryRepository);
        var result = await handler.Handle(new GetTeamReportQuery(_workspaceId, start, end), CancellationToken.None);

        // current window: 1 completed; previous window: 1 completed → delta 0
        Assert.Equal(0, result.Trends.CompletedDelta);
        Assert.NotNull(result.Trends.CycleTimeDelta);
    }

    private static TaskItem DoneTask(string title, DateTimeOffset started, DateTimeOffset completed)
    {
        var task = TaskItem.Create(Guid.NewGuid(), title, null, TaskItemPriority.Medium);

        typeof(TaskItem).GetProperty(nameof(TaskItem.Status))!.SetValue(task, TaskItemStatus.Done);
        typeof(TaskItem).GetProperty(nameof(TaskItem.StartedAtUtc))!.SetValue(task, started);
        typeof(TaskItem).GetProperty(nameof(TaskItem.CompletedAtUtc))!.SetValue(task, completed);

        return task;
    }
}
