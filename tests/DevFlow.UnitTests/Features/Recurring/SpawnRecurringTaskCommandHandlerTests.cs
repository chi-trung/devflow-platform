using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Recurring.Spawn;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Recurring;

public class SpawnRecurringTaskCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IRecurringTaskRuleRepository _ruleRepository = Substitute.For<IRecurringTaskRuleRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IActivityLogRepository _activityLogRepository = Substitute.For<IActivityLogRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly RecurringTaskRule _rule;
    private readonly DateTimeOffset _occurrence;

    public SpawnRecurringTaskCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _occurrence = new DateTimeOffset(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);
        _rule = RecurringTaskRule.Create(
            _project.Id, "Daily report", "Write the report",
            TaskItemPriority.High, RecurrenceFrequency.Daily, 1,
            _occurrence, Guid.NewGuid());
        // Create() sets Next = FirstDue; pin it for a deterministic CAS.
        while (_rule.NextOccurrenceUtc != _occurrence)
        {
            // FirstDueDateUtc already equals _occurrence via Create.
            break;
        }

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _ruleRepository.GetByIdAsync(_rule.Id, Arg.Any<CancellationToken>()).Returns(_rule);
        _taskItemRepository.GetMaxNumberAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(7);
    }

    private SpawnRecurringTaskCommandHandler CreateHandler() =>
        new(_projectRepository, _ruleRepository, _taskItemRepository, _activityLogRepository, _unitOfWork);

    private SpawnRecurringTaskCommand Command() =>
        new(_project.Id, _rule.Id, _occurrence);

    [Fact]
    public async Task Handle_ShouldMintTask_WithDueDateAndNextNumber()
    {
        TaskItem? added = null;
        _taskItemRepository.When(r => r.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(call => added = call.Arg<TaskItem>());

        var taskId = await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.NotNull(taskId);
        Assert.NotNull(added);
        Assert.Equal(8, added!.Number);
        Assert.Equal(_occurrence, added.DueDateUtc);
        Assert.Equal("Daily report", added.Title);
        Assert.Equal(TaskItemPriority.High, added.Priority);
        // Cursor advanced one day past the claimed occurrence.
        Assert.Equal(_occurrence.AddDays(1), _rule.NextOccurrenceUtc);
    }

    [Fact]
    public async Task Handle_ShouldLogActivity_WithRuleCreatorAsActor()
    {
        ActivityLog? log = null;
        _activityLogRepository.When(r => r.AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>()))
            .Do(call => log = call.Arg<ActivityLog>());

        await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.NotNull(log);
        Assert.Equal(_rule.CreatedByUserId, log!.ActorUserId);
        Assert.Equal(_project.Id, log.ProjectId);
        Assert.Equal("created task", log.Action);
        Assert.Equal("Daily report", log.Target);
    }

    [Fact]
    public async Task Handle_ShouldReturnNull_WhenCasMiss_AlreadyAdvanced()
    {
        // Simulate a concurrent worker that already claimed this occurrence.
        Assert.True(_rule.TryAdvanceFrom(_occurrence));

        var result = await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.Null(result);
        _ = _taskItemRepository.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(default);
    }

    [Fact]
    public async Task Handle_ShouldReturnNull_WhenRuleMissing()
    {
        _ruleRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((RecurringTaskRule?)null);

        var result = await CreateHandler().Handle(
            new SpawnRecurringTaskCommand(_project.Id, Guid.NewGuid(), _occurrence),
            CancellationToken.None);

        Assert.Null(result);
        _ = _taskItemRepository.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact]
    public async Task Handle_ShouldReturnNull_WhenRuleInactive()
    {
        _rule.SetActive(false);

        var result = await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.Null(result);
        _ = _taskItemRepository.DidNotReceiveWithAnyArgs().AddAsync(default!, default);
    }

    [Fact]
    public async Task Handle_ShouldRetryWithNewNumber_OnUniqueViolation()
    {
        _taskItemRepository.GetMaxNumberAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(7, 8);
        TaskItem? added = null;
        _taskItemRepository.When(r => r.AddAsync(Arg.Any<TaskItem>(), Arg.Any<CancellationToken>()))
            .Do(call => added = call.Arg<TaskItem>());

        _unitOfWork.SaveChangesAsync(Arg.Any<CancellationToken>())
            .Returns(
                x => throw new Exception("23505: duplicate key value violates unique constraint \"ix_task_items_project_id_number\""),
                x => Task.FromResult(1));

        var result = await CreateHandler().Handle(Command(), CancellationToken.None);

        Assert.NotNull(result);
        Assert.Equal(9, added!.Number);
        await _unitOfWork.Received(2).SaveChangesAsync(Arg.Any<CancellationToken>());
        // Claim still applied across the retry (same in-memory rule).
        Assert.Equal(_occurrence.AddDays(1), _rule.NextOccurrenceUtc);
    }

    [Fact]
    public async Task Handle_ShouldAdvanceMonthly_FromJan31_ClampToFebEnd()
    {
        var jan31 = new DateTimeOffset(2026, 1, 31, 12, 0, 0, TimeSpan.Zero);
        var monthly = RecurringTaskRule.Create(
            _project.Id, "Month-end", null, TaskItemPriority.Low,
            RecurrenceFrequency.Monthly, 1, jan31, Guid.NewGuid());
        _ruleRepository.GetByIdAsync(monthly.Id, Arg.Any<CancellationToken>()).Returns(monthly);

        await CreateHandler().Handle(
            new SpawnRecurringTaskCommand(_project.Id, monthly.Id, jan31),
            CancellationToken.None);

        // .NET AddMonths clamps Jan 31 + 1 month → Feb 28 (non-leap 2026).
        Assert.Equal(new DateTimeOffset(2026, 2, 28, 12, 0, 0, TimeSpan.Zero), monthly.NextOccurrenceUtc);
    }

    [Fact]
    public async Task Handle_ShouldAdvanceWeekly_BySevenTimesInterval()
    {
        var weekly = RecurringTaskRule.Create(
            _project.Id, "Biweekly", null, TaskItemPriority.Medium,
            RecurrenceFrequency.Weekly, 2, _occurrence, Guid.NewGuid());
        _ruleRepository.GetByIdAsync(weekly.Id, Arg.Any<CancellationToken>()).Returns(weekly);

        await CreateHandler().Handle(
            new SpawnRecurringTaskCommand(_project.Id, weekly.Id, _occurrence),
            CancellationToken.None);

        Assert.Equal(_occurrence.AddDays(14), weekly.NextOccurrenceUtc);
    }
}
