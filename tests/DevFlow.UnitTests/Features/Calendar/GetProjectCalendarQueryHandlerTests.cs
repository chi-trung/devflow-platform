using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Calendar;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Calendar;

public class GetProjectCalendarQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public GetProjectCalendarQueryHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    private GetProjectCalendarQueryHandler CreateHandler() =>
        new(_projectRepository, _taskItemRepository);

    private static DateTimeOffset Day(int day) =>
        new(2026, 9, day, 0, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Handle_ShouldThrowNotFound_WhenProjectWorkspaceMismatches()
    {
        var otherWorkspace = Guid.NewGuid();
        var from = Day(1);
        var to = Day(30);

        await Assert.ThrowsAsync<NotFoundException>(() =>
            CreateHandler().Handle(
                new GetProjectCalendarQuery(otherWorkspace, _project.Id, from, to),
                CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldThrowValidation_WhenFromNotBeforeTo()
    {
        var from = Day(10);
        var to = Day(10);

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            CreateHandler().Handle(
                new GetProjectCalendarQuery(_workspaceId, _project.Id, from, to),
                CancellationToken.None));

        Assert.Contains("from", ex.Errors.Keys);
    }

    [Fact]
    public async Task Handle_ShouldThrowValidation_WhenRangeExceeds400Days()
    {
        var from = Day(1);
        var to = from.AddDays(401);

        var ex = await Assert.ThrowsAsync<ValidationException>(() =>
            CreateHandler().Handle(
                new GetProjectCalendarQuery(_workspaceId, _project.Id, from, to),
                CancellationToken.None));

        Assert.Contains("from", ex.Errors.Keys);
    }

    [Fact]
    public async Task Handle_ShouldMapTasks_WithProjectKeyAndRangePassedThrough()
    {
        var from = Day(1);
        var to = Day(8);
        var due = Day(3).AddHours(12);
        var task = TaskItem.Create(_project.Id, "Ship calendar", null, TaskItemPriority.High);
        task.SetDueDate(due);
        task.SetNumber(42);

        _taskItemRepository.GetDueBetweenAsync(_project.Id, from, to, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var result = await CreateHandler().Handle(
            new GetProjectCalendarQuery(_workspaceId, _project.Id, from, to),
            CancellationToken.None);

        var item = Assert.Single(result.Items);
        Assert.Equal("DEV-42", item.Key);
        Assert.Equal("Ship calendar", item.Title);
        Assert.Equal(due, item.DueDateUtc);
        Assert.Equal(nameof(TaskItemStatus.Idea), item.Status);
        _ = _taskItemRepository.Received(1).GetDueBetweenAsync(
            _project.Id, from, to, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReturnEmpty_WhenNoTasksInRange()
    {
        _taskItemRepository.GetDueBetweenAsync(
                _project.Id, Arg.Any<DateTimeOffset>(), Arg.Any<DateTimeOffset>(), Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var result = await CreateHandler().Handle(
            new GetProjectCalendarQuery(_workspaceId, _project.Id, Day(1), Day(30)),
            CancellationToken.None);

        Assert.Empty(result.Items);
    }
}
