using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Projects.Stats;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Projects.Stats;

public class ProjectTaskStatsQueryHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _otherWorkspaceId = Guid.NewGuid();

    private readonly Project _alpha;
    private readonly Project _beta;
    private readonly Project _gamma;

    public ProjectTaskStatsQueryHandlerTests()
    {
        _alpha = Project.Create(_workspaceId, "Alpha", "ALP", null);
        _beta = Project.Create(_workspaceId, "Beta", "BET", null);
        // A third project with no tasks at all — it must still appear, as 0/0,
        // because the response is keyed by projects, not by tasks.
        _gamma = Project.Create(_workspaceId, "Gamma", "GAM", null);
    }

    private static TaskItem NewTask(Guid projectId, string title, TaskItemStatus status)
    {
        var task = TaskItem.Create(projectId, title, null, TaskItemPriority.Medium);
        task.ChangeStatus(status);
        return task;
    }

    [Fact]
    public async Task Handle_ShouldQueryTasksOnceAcrossAllProjects()
    {
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns([_alpha, _beta, _gamma]);

        _taskItemRepository.GetForProjectsAsync(
                Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns(
            [
                NewTask(_alpha.Id, "A1", TaskItemStatus.Done),
                NewTask(_alpha.Id, "A2", TaskItemStatus.InProgress),
                NewTask(_beta.Id, "B1", TaskItemStatus.Done),
            ]);

        var handler = new ProjectTaskStatsQueryHandler(_projectRepository, _taskItemRepository);

        var response = await handler.Handle(new ProjectTaskStatsQuery(_workspaceId), CancellationToken.None);

        // ONE task query, regardless of how many projects there are — the
        // per-project /tasks fan-out this replaces issued N.
        await _taskItemRepository.Received(1).GetForProjectsAsync(
            Arg.Any<IEnumerable<Guid>>(), (TaskItemStatus?)null, Arg.Any<CancellationToken>());

        Assert.Equal(3, response.Count);

        var byProject = response.ToDictionary(r => r.ProjectId);
        Assert.Equal(2, byProject[_alpha.Id].TotalTasks);
        Assert.Equal(1, byProject[_alpha.Id].DoneTasks);
        Assert.Equal(1, byProject[_beta.Id].TotalTasks);
        Assert.Equal(1, byProject[_beta.Id].DoneTasks);
        // No tasks for Gamma, and it still reports honestly rather than
        // vanishing from the list.
        Assert.Equal(0, byProject[_gamma.Id].TotalTasks);
        Assert.Equal(0, byProject[_gamma.Id].DoneTasks);
    }

    [Fact]
    public async Task Handle_ShouldScopeTasksToTheVisibleProjects()
    {
        // A project the caller cannot see (here: another workspace entirely)
        // contributes nothing, because the task query only receives the ids
        // the project list returned.
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns([_alpha]);

        _taskItemRepository.GetForProjectsAsync(
                Arg.Is<IEnumerable<Guid>>(ids => ids.Contains(_alpha.Id) && !ids.Contains(_beta.Id)),
                (TaskItemStatus?)null, Arg.Any<CancellationToken>())
            .Returns([NewTask(_alpha.Id, "A1", TaskItemStatus.Done)]);

        var handler = new ProjectTaskStatsQueryHandler(_projectRepository, _taskItemRepository);

        var response = await handler.Handle(new ProjectTaskStatsQuery(_workspaceId), CancellationToken.None);

        var only = Assert.Single(response);
        Assert.Equal(_alpha.Id, only.ProjectId);
        Assert.Equal(1, only.TotalTasks);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmpty_WhenWorkspaceHasNoProjects()
    {
        _projectRepository.GetForWorkspaceAsync(_otherWorkspaceId, Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = new ProjectTaskStatsQueryHandler(_projectRepository, _taskItemRepository);

        var response = await handler.Handle(
            new ProjectTaskStatsQuery(_otherWorkspaceId), CancellationToken.None);

        Assert.Empty(response);
    }
}
