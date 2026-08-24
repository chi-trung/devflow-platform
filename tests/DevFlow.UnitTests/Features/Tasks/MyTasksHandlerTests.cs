using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.MyTasks;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class MyTasksHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Guid _otherUserId = Guid.NewGuid();
    private readonly Project _project1;
    private readonly Project _project2;

    public MyTasksHandlerTests()
    {
        _project1 = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _project2 = Project.Create(_workspaceId, "Marketing", "MKT", null);

        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { _project1, _project2 });
    }

    private GetMyTasksQueryHandler CreateHandler()
    {
        return new GetMyTasksQueryHandler(
            _projectRepository, _taskItemRepository, _sprintRepository);
    }

    [Fact]
    public async Task Handle_ShouldReturnOnlyCurrentUsersTasks()
    {
        var myTask = TaskItem.Create(_project1.Id, "My assigned task", null, TaskItemPriority.High);
        myTask.AssignTo(_userId);
        // otherTask belongs to another user — repository filters it out already.
        var otherTask = TaskItem.Create(_project1.Id, "Other task", null, TaskItemPriority.Medium);
        otherTask.AssignTo(_otherUserId);

        _taskItemRepository.GetByAssigneeIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { myTask });
        _taskItemRepository.GetByAssigneeIdAsync(_otherUserId, Arg.Any<CancellationToken>())
            .Returns(new[] { otherTask });

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("My assigned task", result[0].Title);
        Assert.Equal(_project1.Name, result[0].ProjectName);
        Assert.Equal(_project1.Key, result[0].ProjectKey);
    }

    [Fact]
    public async Task Handle_ShouldExcludeTasksFromOtherWorkspacesProjects()
    {
        var otherWorkspaceProject = Project.Create(Guid.NewGuid(), "Other WS", "OTH", null);

        var taskInOtherWorkspace = TaskItem.Create(otherWorkspaceProject.Id, "Foreign task", null, TaskItemPriority.Low);
        taskInOtherWorkspace.AssignTo(_userId);

        var myTask = TaskItem.Create(_project1.Id, "My task", null, TaskItemPriority.Medium);
        myTask.AssignTo(_userId);

        _taskItemRepository.GetByAssigneeIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { taskInOtherWorkspace, myTask });

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Single(result);
        Assert.Equal("My task", result[0].Title);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmpty_WhenNoTasksAssigned()
    {
        _taskItemRepository.GetByAssigneeIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Empty(result);
    }

    [Fact]
    public async Task Handle_ShouldResolveSprintName()
    {
        var sprint = Sprint.Create(_project1.Id, "Sprint 7", "Ship it");

        var task = TaskItem.Create(_project1.Id, "In sprint task", null, TaskItemPriority.Medium);
        task.AssignTo(_userId);
        task.AssignToSprint(sprint.Id);

        _taskItemRepository.GetByAssigneeIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { task });
        _sprintRepository.GetByIdAsync(sprint.Id, Arg.Any<CancellationToken>())
            .Returns(sprint);

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal("Sprint 7", item.SprintName);
        Assert.Equal(sprint.Id, item.SprintId);
    }

    [Fact]
    public async Task Handle_ShouldExposeStatusAndPriorityStrings()
    {
        var task = TaskItem.Create(_project1.Id, "Status task", null, TaskItemPriority.Critical);
        task.AssignTo(_userId);
        task.ChangeStatus(TaskItemStatus.InProgress);

        _taskItemRepository.GetByAssigneeIdAsync(_userId, Arg.Any<CancellationToken>())
            .Returns(new[] { task });

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        var item = Assert.Single(result);
        Assert.Equal("InProgress", item.Status);
        Assert.Equal("Critical", item.Priority);
        Assert.Equal(TaskItemStatus.InProgress, task.Status);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmpty_WhenWorkspaceHasNoProjects()
    {
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns([]);

        var handler = CreateHandler();
        var query = new GetMyTasksQuery(_workspaceId, _userId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Empty(result);
    }
}
