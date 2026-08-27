using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Suggest;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

/// <summary>
/// Tests for the context-aware prompt suggestion handler. It reads real project
/// data (sprints, epics, tasks) and returns i18n keys + interpolation args so
/// the frontend shows grounded suggestions instead of static ones.
/// </summary>
public class AiSuggestCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public AiSuggestCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
    }

    private Task<List<AiSuggestion>> Handle(Guid? projectId = null, Guid? epicId = null) =>
        new AiSuggestCommandHandler(
            _projectRepository,
            _sprintRepository,
            _epicRepository,
            _taskItemRepository)
            .Handle(new AiSuggestCommand(_workspaceId, projectId, null, epicId), CancellationToken.None);

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
    public async Task Handle_ShouldSuggestAssigningUnassignedTasks_WhenSomeExist()
    {
        var task = TaskItem.Create(_project.Id, "Login screen", null, TaskItemPriority.High);

        _sprintRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Sprint>());
        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic>());
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
            .Returns(new List<Epic>());
        _taskItemRepository.GetForProjectAsync(active.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var suggestions = await Handle(active.Id);

        Assert.Contains(suggestions, s => s.Key == "ai.suggestStartSprint");
        Assert.Equal("Sprint 1", suggestions.Single(s => s.Key == "ai.suggestStartSprint").Args!["sprint"]);
    }

    [Fact]
    public async Task Handle_ShouldReturnAtMostFourSuggestions()
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

        Assert.InRange(suggestions.Count, 1, 4);
        Assert.DoesNotContain(suggestions, s => string.IsNullOrEmpty(s.Key));
    }
}
