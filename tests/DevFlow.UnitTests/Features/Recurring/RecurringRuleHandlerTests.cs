using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Recurring.Create;
using DevFlow.Application.Features.Recurring.Delete;
using DevFlow.Application.Features.Recurring.List;
using DevFlow.Application.Features.Recurring.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Recurring;

public class RecurringRuleHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly IRecurringTaskRuleRepository _ruleRepository = Substitute.For<IRecurringTaskRuleRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public RecurringRuleHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _userContext.UserId.Returns(Guid.NewGuid());
    }

    private CreateRecurringRuleCommandHandler CreateCreateHandler() =>
        new(_projectRepository, _ruleRepository, _userContext, _unitOfWork);

    private static DateTimeOffset Due() =>
        new(2026, 10, 1, 9, 0, 0, TimeSpan.Zero);

    [Fact]
    public async Task Create_ShouldStampCreatorAndDefaultNextFromFirstDue()
    {
        RecurringTaskRule? added = null;
        _ruleRepository.When(r => r.AddAsync(Arg.Any<RecurringTaskRule>(), Arg.Any<CancellationToken>()))
            .Do(call => added = call.Arg<RecurringTaskRule>());

        var result = await CreateCreateHandler().Handle(
            new CreateRecurringRuleCommand(
                _workspaceId, _project.Id, "Weekly standup", null,
                TaskItemPriority.Medium, RecurrenceFrequency.Weekly, 1, Due()),
            CancellationToken.None);

        Assert.NotNull(added);
        Assert.Equal(_userContext.UserId, added!.CreatedByUserId);
        Assert.Equal(Due(), added.NextOccurrenceUtc);
        Assert.True(added.IsActive);
        Assert.Equal(result.Id, added.Id);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Create_ShouldThrowNotFound_WhenProjectWorkspaceMismatches()
    {
        await Assert.ThrowsAsync<NotFoundException>(() => CreateCreateHandler().Handle(
            new CreateRecurringRuleCommand(
                Guid.NewGuid(), _project.Id, "Weekly standup", null,
                TaskItemPriority.Medium, RecurrenceFrequency.Weekly, 1, Due()),
            CancellationToken.None));
    }

    [Fact]
    public async Task Create_ShouldThrowValidation_WhenIntervalZero()
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(() => CreateCreateHandler().Handle(
            new CreateRecurringRuleCommand(
                _workspaceId, _project.Id, "Weekly standup", null,
                TaskItemPriority.Medium, RecurrenceFrequency.Weekly, 0, Due()),
            CancellationToken.None));

        Assert.Contains("interval", ex.Errors.Keys);
    }

    [Fact]
    public async Task Create_ShouldThrowValidation_WhenTitleEmpty()
    {
        var ex = await Assert.ThrowsAsync<ValidationException>(() => CreateCreateHandler().Handle(
            new CreateRecurringRuleCommand(
                _workspaceId, _project.Id, "  ", null,
                TaskItemPriority.Medium, RecurrenceFrequency.Daily, 1, Due()),
            CancellationToken.None));

        Assert.Contains("title", ex.Errors.Keys);
    }

    [Fact]
    public async Task List_ShouldThrowNotFound_WhenProjectWorkspaceMismatches()
    {
        var handler = new ListRecurringRulesQueryHandler(_projectRepository, _ruleRepository);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new ListRecurringRulesQuery(Guid.NewGuid(), _project.Id),
            CancellationToken.None));
    }

    [Fact]
    public async Task List_ShouldMapRules()
    {
        var rule = RecurringTaskRule.Create(
            _project.Id, "Daily report", "desc", TaskItemPriority.Low,
            RecurrenceFrequency.Daily, 2, Due(), Guid.NewGuid());
        _ruleRepository.GetByProjectIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<RecurringTaskRule> { rule });

        var handler = new ListRecurringRulesQueryHandler(_projectRepository, _ruleRepository);
        var result = await handler.Handle(
            new ListRecurringRulesQuery(_workspaceId, _project.Id),
            CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal("Daily report", item.Title);
        Assert.Equal(nameof(RecurrenceFrequency.Daily), item.Frequency);
        Assert.Equal(2, item.Interval);
    }

    [Fact]
    public async Task Update_ShouldRecomputeNext_WhenCadenceChangesWhileActive()
    {
        var rule = RecurringTaskRule.Create(
            _project.Id, "Old", null, TaskItemPriority.Medium,
            RecurrenceFrequency.Daily, 1, Due(), Guid.NewGuid());
        _ruleRepository.GetByIdAsync(rule.Id, Arg.Any<CancellationToken>()).Returns(rule);

        var handler = new UpdateRecurringRuleCommandHandler(_projectRepository, _ruleRepository, _unitOfWork);
        var newDue = Due().AddDays(7);

        var result = await handler.Handle(
            new UpdateRecurringRuleCommand(
                _workspaceId, _project.Id, rule.Id, "New title", null,
                TaskItemPriority.High, RecurrenceFrequency.Weekly, 2, newDue, true),
            CancellationToken.None);

        Assert.Equal("New title", result.Title);
        Assert.Equal(nameof(RecurrenceFrequency.Weekly), result.Frequency);
        // Cadence changed while active → Next recomputed from UtcNow (not
        // left on the old firstDue). Just assert it moved off Due().
        Assert.NotEqual(Due(), result.NextOccurrenceUtc);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Update_ShouldThrowNotFound_WhenRuleInOtherProject()
    {
        var foreign = RecurringTaskRule.Create(
            Guid.NewGuid(), "Foreign", null, TaskItemPriority.Medium,
            RecurrenceFrequency.Daily, 1, Due(), Guid.NewGuid());
        _ruleRepository.GetByIdAsync(foreign.Id, Arg.Any<CancellationToken>()).Returns(foreign);

        var handler = new UpdateRecurringRuleCommandHandler(_projectRepository, _ruleRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new UpdateRecurringRuleCommand(
                _workspaceId, _project.Id, foreign.Id, "New", null,
                TaskItemPriority.Medium, RecurrenceFrequency.Daily, 1, Due(), true),
            CancellationToken.None));
    }

    [Fact]
    public async Task Delete_ShouldRemoveAndSave()
    {
        var rule = RecurringTaskRule.Create(
            _project.Id, "Doomed", null, TaskItemPriority.Medium,
            RecurrenceFrequency.Daily, 1, Due(), Guid.NewGuid());
        _ruleRepository.GetByIdAsync(rule.Id, Arg.Any<CancellationToken>()).Returns(rule);

        var handler = new DeleteRecurringRuleCommandHandler(_projectRepository, _ruleRepository, _unitOfWork);

        await handler.Handle(
            new DeleteRecurringRuleCommand(_workspaceId, _project.Id, rule.Id),
            CancellationToken.None);

        await _ruleRepository.Received(1).RemoveAsync(rule, Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Delete_ShouldThrowNotFound_WhenRuleMissing()
    {
        _ruleRepository.GetByIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns((RecurringTaskRule?)null);

        var handler = new DeleteRecurringRuleCommandHandler(_projectRepository, _ruleRepository, _unitOfWork);

        await Assert.ThrowsAsync<NotFoundException>(() => handler.Handle(
            new DeleteRecurringRuleCommand(_workspaceId, _project.Id, Guid.NewGuid()),
            CancellationToken.None));
    }
}
