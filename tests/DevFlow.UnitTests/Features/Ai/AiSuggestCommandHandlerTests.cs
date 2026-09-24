using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Suggest;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

/// <summary>
/// Tests for the context-aware prompt suggestion handler. It reads real project
/// data (sprints, epics, tasks, due dates, blockers), scores candidates against
/// the page context, demotes recently used keys, and returns i18n keys +
/// interpolation args so the frontend shows grounded, rotating suggestions.
/// </summary>
public class AiSuggestCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ITaskDependencyRepository _dependencyRepository = Substitute.For<ITaskDependencyRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public AiSuggestCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
        _dependencyRepository.GetAllByProjectIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency>());
    }

    private Task<List<AiSuggestion>> Handle(
        Guid? projectId = null,
        Guid? epicId = null,
        string? pageContext = null,
        IReadOnlyList<string>? excludeKeys = null) =>
        new AiSuggestCommandHandler(
            _projectRepository,
            _sprintRepository,
            _epicRepository,
            _taskItemRepository,
            _dependencyRepository)
            .Handle(
                new AiSuggestCommand(_workspaceId, projectId, pageContext, epicId, excludeKeys),
                CancellationToken.None);

    [Fact]
    public async Task Handle_ShouldReturnProjectCreation_WhenNoProjectsExist()
    {
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project>());

        var suggestions = await Handle();

        Assert.Contains(suggestions, s => s.Key == "ai.suggestCreateProject");
        Assert.Contains(suggestions, s => s.Key == "ai.suggestCreateTask");
    }

    [Fact]
    public async Task Handle_ShouldSuggestStartingPlannedSprint_WhenNoActiveSprint()
    {
        var planned = Sprint.Create(_project.Id, "Sprint 12", null);
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { planned });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });

        var suggestions = await Handle();

        var start = suggestions.Single(s => s.Key == "ai.suggestStartSprint");
        Assert.Equal("Sprint 12", start.Args!["sprint"]);
    }

    [Fact]
    public async Task Handle_ShouldSuggestAddingToActiveSprint_WhenOneExists()
    {
        var active = Sprint.Create(_project.Id, "Sprint 11", null);
        active.Start(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(14));

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { active });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });

        var suggestions = await Handle();

        var add = suggestions.Single(s => s.Key == "ai.suggestAddTaskToSprint");
        Assert.Equal("Sprint 11", add.Args!["sprint"]);
    }

    [Fact]
    public async Task Handle_ShouldSuggestCreateEpic_WhenNoEpicsExist()
    {
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic>());
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle();

        Assert.Contains(suggestions, s => s.Key == "ai.suggestCreateEpic");
    }

    [Fact]
    public async Task Handle_ShouldSuggestCreateSprint_WhenNoSprintsExist()
    {
        // Without this chip the dock only surfaces task/epic creates — the
        // user never gets a grounded "create a sprint" prompt.
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic>());
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle(pageContext: "sprints");

        Assert.Contains(suggestions, s => s.Key == "ai.suggestCreateSprint");
    }

    [Fact]
    public async Task Handle_ShouldSuggestCreateSprint_WhenOnlyCompletedSprintsExist()
    {
        var done = Sprint.Create(_project.Id, "Sprint 10", null);
        done.Start(DateTimeOffset.UtcNow.AddDays(-14), DateTimeOffset.UtcNow.AddDays(-7));
        done.Complete();
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { done });
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic>());
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle();

        Assert.Contains(suggestions, s => s.Key == "ai.suggestCreateSprint");
    }

    [Fact]
    public async Task Handle_ShouldSuggestAssigningUnassignedTasks_WhenSomeExist()
    {
        var task = TaskItem.Create(_project.Id, "Login screen", null, TaskItemPriority.High);

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var suggestions = await Handle();

        var assign = suggestions.Single(s => s.Key == "ai.suggestAssignTasks");
        Assert.Equal("1", assign.Args!["count"]);
    }

    [Fact]
    public async Task Handle_ShouldUseActiveProject_WhenProjectIdMatches()
    {
        var other = Project.Create(_workspaceId, "Other", "OTH", null);
        var active = Project.Create(_workspaceId, "Active", "ACT", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { other, active });

        var sprint = Sprint.Create(active.Id, "Sprint 1", null);
        _sprintRepository.GetForProjectAsync(active.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { sprint });
        _sprintRepository.GetForProjectAsync(other.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(active.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(active.Id, "Auth", null) });
        _epicRepository.GetForProjectAsync(other.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic>());
        _taskItemRepository.GetForProjectAsync(active.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());
        _taskItemRepository.GetForProjectAsync(other.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());
        _dependencyRepository.GetAllByProjectIdAsync(active.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency>());

        var suggestions = await Handle(active.Id);

        Assert.Contains(suggestions, s => s.Key == "ai.suggestStartSprint");
        Assert.Equal("Sprint 1", suggestions.Single(s => s.Key == "ai.suggestStartSprint").Args!["sprint"]);
    }

    [Fact]
    public async Task Handle_ShouldReturnAtMostSixSuggestions()
    {
        var active = Sprint.Create(_project.Id, "Sprint 1", null);
        active.Start(DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(7));
        var epic = Epic.Create(_project.Id, "Auth", null);
        var task = TaskItem.Create(_project.Id, "Login", null, TaskItemPriority.High);

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { active });
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { epic });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var suggestions = await Handle();

        Assert.InRange(suggestions.Count, 1, 6);
        Assert.DoesNotContain(suggestions, s => string.IsNullOrEmpty(s.Key));
        Assert.Equal(suggestions.Count, suggestions.Select(s => s.Key).Distinct().Count());
    }

    [Fact]
    public async Task Handle_ShouldSuggestReviewingOverdue_WhenDueDatePassed()
    {
        var task = TaskItem.Create(_project.Id, "Late login", null, TaskItemPriority.High);
        task.SetDueDate(DateTimeOffset.UtcNow.AddDays(-2));

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var suggestions = await Handle(pageContext: "board");

        var overdue = suggestions.Single(s => s.Key == "ai.suggestReviewOverdue");
        Assert.Equal("1", overdue.Args!["count"]);
        // Urgency outranks generic fillers on the board page.
        Assert.True(
            suggestions.FindIndex(s => s.Key == "ai.suggestReviewOverdue") <
            suggestions.FindIndex(s => s.Key == "ai.suggestPlanMilestones"));
    }

    [Fact]
    public async Task Handle_ShouldSuggestDueSoon_WhenDueDateWithinThreeDays()
    {
        var task = TaskItem.Create(_project.Id, "Due tomorrow", null, TaskItemPriority.Medium);
        task.SetDueDate(DateTimeOffset.UtcNow.AddDays(1));

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var suggestions = await Handle();

        var due = suggestions.Single(s => s.Key == "ai.suggestDueSoon");
        Assert.Equal("1", due.Args!["count"]);
    }

    [Fact]
    public async Task Handle_ShouldSuggestWrapUp_WhenActiveSprintEndsSoon()
    {
        var active = Sprint.Create(_project.Id, "Sprint Final", null);
        active.Start(DateTimeOffset.UtcNow.AddDays(-11), DateTimeOffset.UtcNow.AddDays(2));

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { active });
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle(pageContext: "sprints");

        var wrap = suggestions.Single(s => s.Key == "ai.suggestWrapUpSprint");
        Assert.Equal("Sprint Final", wrap.Args!["sprint"]);
    }

    [Fact]
    public async Task Handle_ShouldSuggestUnblock_WhenDependencyBlockerUnfinished()
    {
        var blocker = TaskItem.Create(_project.Id, "API schema", null, TaskItemPriority.High);
        var blocked = TaskItem.Create(_project.Id, "Wire client", null, TaskItemPriority.Medium);
        var edge = TaskDependency.Create(blocked.Id, blocker.Id);

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { blocker, blocked });
        _dependencyRepository.GetAllByProjectIdAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency> { edge });

        var suggestions = await Handle();

        var unblock = suggestions.Single(s => s.Key == "ai.suggestUnblockTasks");
        Assert.Equal("1", unblock.Args!["count"]);
    }

    [Fact]
    public async Task Handle_ShouldBoostSprintSignals_OnSprintsPage()
    {
        var planned = Sprint.Create(_project.Id, "Next", null);
        var task = TaskItem.Create(_project.Id, "Login", null, TaskItemPriority.Low);

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { planned });
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        var suggestions = await Handle(pageContext: "sprints");

        Assert.Equal("ai.suggestStartSprint", suggestions[0].Key);
    }

    [Fact]
    public async Task Handle_ShouldDemoteRecentlyUsedKeys()
    {
        var planned = Sprint.Create(_project.Id, "Sprint 9", null);
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint> { planned });
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        // User just picked the milestone chip — it should not lead the next open.
        var suggestions = await Handle(excludeKeys: new[] { "ai.suggestPlanMilestones" });

        Assert.DoesNotContain(suggestions, s => s.Key == "ai.suggestPlanMilestones");
        Assert.Contains(suggestions, s => s.Key == "ai.suggestStartSprint");
        Assert.True(suggestions.Count >= 3);
    }

    [Fact]
    public async Task Handle_ShouldKeepMinSuggestions_WhenAllTopKeysExcluded()
    {
        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { Epic.Create(_project.Id, "Auth", null) });
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle(excludeKeys: new[]
        {
            "ai.suggestPlanMilestones",
            "ai.suggestCreateTask",
            "ai.suggestCreateEpic",
            "ai.suggestCreateProject",
        });

        Assert.True(suggestions.Count >= 3);
    }
}
