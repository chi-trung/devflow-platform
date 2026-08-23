using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Dependencies;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks.Dependencies;

public class DependencyGraphHandlerTests
{
    private readonly ITaskDependencyRepository _dependencyRepository = Substitute.For<ITaskDependencyRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IActivityLogRepository _activityLog = Substitute.For<IActivityLogRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task GetProjectDependencyGraph_ShouldReturnNodesAndEdges_WhenDependenciesExist()
    {
        var taskA = TaskItem.Create(_projectId, "Task A", null, TaskItemPriority.Low);
        var taskB = TaskItem.Create(_projectId, "Task B", null, TaskItemPriority.Medium);
        var taskC = TaskItem.Create(_projectId, "Task C", null, TaskItemPriority.High);

        var depAB = TaskDependency.Create(taskA.Id, taskB.Id);
        var depBC = TaskDependency.Create(taskC.Id, taskB.Id);

        _dependencyRepository.GetAllByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency> { depAB, depBC });

        _taskItemRepository.GetByIdAsync(taskA.Id, Arg.Any<CancellationToken>()).Returns(taskA);
        _taskItemRepository.GetByIdAsync(taskB.Id, Arg.Any<CancellationToken>()).Returns(taskB);
        _taskItemRepository.GetByIdAsync(taskC.Id, Arg.Any<CancellationToken>()).Returns(taskC);

        var handler = new GetProjectDependencyGraphHandler(_dependencyRepository, _taskItemRepository);
        var query = new GetProjectDependencyGraphQuery(_workspaceId, _projectId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Equal(3, result.Nodes.Count);
        Assert.Equal(2, result.Edges.Count);
        Assert.Empty(result.CyclicNodeIds);
        Assert.Contains(result.Nodes, n => n.Id == taskA.Id);
        Assert.Contains(result.Nodes, n => n.Id == taskB.Id);
        Assert.Contains(result.Nodes, n => n.Id == taskC.Id);
        Assert.Contains(result.Edges, e => e.FromTaskId == taskA.Id && e.ToTaskId == taskB.Id);
        Assert.Contains(result.Edges, e => e.FromTaskId == taskC.Id && e.ToTaskId == taskB.Id);
    }

    [Fact]
    public async Task GetProjectDependencyGraph_ShouldReturnEmptyGraph_WhenNoDependenciesExist()
    {
        _dependencyRepository.GetAllByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency>());

        var handler = new GetProjectDependencyGraphHandler(_dependencyRepository, _taskItemRepository);
        var query = new GetProjectDependencyGraphQuery(_workspaceId, _projectId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Empty(result.Nodes);
        Assert.Empty(result.Edges);
        Assert.Empty(result.CyclicNodeIds);
    }

    [Fact]
    public async Task GetProjectDependencyGraph_ShouldDetectCyclicNodes_WhenCycleExists()
    {
        var taskA = TaskItem.Create(_projectId, "Task A", null, TaskItemPriority.Low);
        var taskB = TaskItem.Create(_projectId, "Task B", null, TaskItemPriority.Medium);
        var taskC = TaskItem.Create(_projectId, "Task C", null, TaskItemPriority.High);

        var depAB = TaskDependency.Create(taskA.Id, taskB.Id);
        var depBC = TaskDependency.Create(taskB.Id, taskC.Id);
        var depCA = TaskDependency.Create(taskC.Id, taskA.Id);

        _dependencyRepository.GetAllByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency> { depAB, depBC, depCA });

        _taskItemRepository.GetByIdAsync(taskA.Id, Arg.Any<CancellationToken>()).Returns(taskA);
        _taskItemRepository.GetByIdAsync(taskB.Id, Arg.Any<CancellationToken>()).Returns(taskB);
        _taskItemRepository.GetByIdAsync(taskC.Id, Arg.Any<CancellationToken>()).Returns(taskC);

        var handler = new GetProjectDependencyGraphHandler(_dependencyRepository, _taskItemRepository);
        var query = new GetProjectDependencyGraphQuery(_workspaceId, _projectId);

        var result = await handler.Handle(query, CancellationToken.None);

        Assert.Equal(3, result.Nodes.Count);
        Assert.Equal(3, result.Edges.Count);
        Assert.Equal(3, result.CyclicNodeIds.Count);
        Assert.All(result.Edges, e => Assert.True(e.IsCyclic));
    }

    [Fact]
    public async Task AddTaskDependency_ShouldThrowConflict_WhenCircularDependencyDetected()
    {
        var taskA = TaskItem.Create(_projectId, "Task A", null, TaskItemPriority.Low);
        var taskB = TaskItem.Create(_projectId, "Task B", null, TaskItemPriority.Medium);
        var taskC = TaskItem.Create(_projectId, "Task C", null, TaskItemPriority.High);

        var existingDeps = new List<TaskDependency>
        {
            TaskDependency.Create(taskB.Id, taskC.Id),
            TaskDependency.Create(taskA.Id, taskB.Id)
        };

        _taskItemRepository.GetByIdAsync(taskA.Id, Arg.Any<CancellationToken>()).Returns(taskA);
        _taskItemRepository.GetByIdAsync(taskB.Id, Arg.Any<CancellationToken>()).Returns(taskB);
        _taskItemRepository.GetByIdAsync(taskC.Id, Arg.Any<CancellationToken>()).Returns(taskC);

        _dependencyRepository.ExistsAsync(taskC.Id, taskB.Id, Arg.Any<CancellationToken>())
            .Returns(false);
        _dependencyRepository.GetAllByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(existingDeps);

        _userContext.UserId.Returns(Guid.NewGuid());

        var handler = new AddTaskDependencyHandler(
            _dependencyRepository, _taskItemRepository, _activityLog, _userContext, _unitOfWork);
        var command = new AddTaskDependencyCommand(_workspaceId, _projectId, taskC.Id, taskB.Id);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }

    [Fact]
    public async Task AddTaskDependency_ShouldSucceed_WhenNoCycleExists()
    {
        var taskA = TaskItem.Create(_projectId, "Task A", null, TaskItemPriority.Low);
        var taskB = TaskItem.Create(_projectId, "Task B", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(taskA.Id, Arg.Any<CancellationToken>()).Returns(taskA);
        _taskItemRepository.GetByIdAsync(taskB.Id, Arg.Any<CancellationToken>()).Returns(taskB);

        _dependencyRepository.ExistsAsync(taskA.Id, taskB.Id, Arg.Any<CancellationToken>())
            .Returns(false);
        _dependencyRepository.GetAllByProjectIdAsync(_projectId, Arg.Any<CancellationToken>())
            .Returns(new List<TaskDependency>());

        _userContext.UserId.Returns(Guid.NewGuid());

        var handler = new AddTaskDependencyHandler(
            _dependencyRepository, _taskItemRepository, _activityLog, _userContext, _unitOfWork);
        var command = new AddTaskDependencyCommand(_workspaceId, _projectId, taskA.Id, taskB.Id);

        await handler.Handle(command, CancellationToken.None);

        await _dependencyRepository.Received(1).AddAsync(Arg.Is<TaskDependency>(d =>
            d.BlockedTaskId == taskA.Id && d.BlockerTaskId == taskB.Id), Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddTaskDependency_ShouldThrowConflict_WhenDuplicateDependencyExists()
    {
        var taskA = TaskItem.Create(_projectId, "Task A", null, TaskItemPriority.Low);
        var taskB = TaskItem.Create(_projectId, "Task B", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(taskA.Id, Arg.Any<CancellationToken>()).Returns(taskA);
        _taskItemRepository.GetByIdAsync(taskB.Id, Arg.Any<CancellationToken>()).Returns(taskB);

        _dependencyRepository.ExistsAsync(taskA.Id, taskB.Id, Arg.Any<CancellationToken>())
            .Returns(true);

        var handler = new AddTaskDependencyHandler(
            _dependencyRepository, _taskItemRepository, _activityLog, _userContext, _unitOfWork);
        var command = new AddTaskDependencyCommand(_workspaceId, _projectId, taskA.Id, taskB.Id);

        await Assert.ThrowsAsync<ConflictException>(() => handler.Handle(command, CancellationToken.None));
    }
}
