using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.BulkOperations;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.BulkOperations;

public class BulkOperationsHandlerTests
{
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task BulkMove_ShouldMoveOnlyTasksInProject()
    {
        var inProject = TaskItem.Create(_projectId, "A", null, TaskItemPriority.Medium);
        var otherProject = TaskItem.Create(Guid.NewGuid(), "B", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(inProject.Id, Arg.Any<CancellationToken>()).Returns(inProject);
        _taskItemRepository.GetByIdAsync(otherProject.Id, Arg.Any<CancellationToken>()).Returns(otherProject);

        var handler = new BulkMoveTasksHandler(_taskItemRepository, _unitOfWork);
        var count = await handler.Handle(
            new BulkMoveTasksCommand(_workspaceId, _projectId, new List<Guid> { inProject.Id, otherProject.Id }, TaskItemStatus.Done),
            CancellationToken.None);

        Assert.Equal(1, count);
        Assert.Equal(TaskItemStatus.Done, inProject.Status);
        Assert.NotEqual(TaskItemStatus.Done, otherProject.Status);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BulkAssign_ShouldAssignOnlyTasksInProject()
    {
        var assigneeId = Guid.NewGuid();
        var inProject = TaskItem.Create(_projectId, "A", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(inProject.Id, Arg.Any<CancellationToken>()).Returns(inProject);

        var handler = new BulkAssignTasksHandler(_taskItemRepository, _unitOfWork);
        var count = await handler.Handle(
            new BulkAssignTasksCommand(_workspaceId, _projectId, new List<Guid> { inProject.Id }, assigneeId),
            CancellationToken.None);

        Assert.Equal(1, count);
        Assert.Equal(assigneeId, inProject.AssigneeId);
    }

    [Fact]
    public async Task BulkDelete_ShouldRemoveOnlyTasksInProject()
    {
        var inProject = TaskItem.Create(_projectId, "A", null, TaskItemPriority.Medium);
        var otherProject = TaskItem.Create(Guid.NewGuid(), "B", null, TaskItemPriority.Medium);

        _taskItemRepository.GetByIdAsync(inProject.Id, Arg.Any<CancellationToken>()).Returns(inProject);
        _taskItemRepository.GetByIdAsync(otherProject.Id, Arg.Any<CancellationToken>()).Returns(otherProject);

        var handler = new BulkDeleteTasksHandler(_taskItemRepository, _unitOfWork);
        var count = await handler.Handle(
            new BulkDeleteTasksCommand(_workspaceId, _projectId, new List<Guid> { inProject.Id, otherProject.Id }),
            CancellationToken.None);

        Assert.Equal(1, count);
        await _taskItemRepository.Received(1).RemoveAsync(inProject, Arg.Any<CancellationToken>());
        await _taskItemRepository.DidNotReceive().RemoveAsync(otherProject, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task BulkMove_WithEmptyList_ShouldReturnZero()
    {
        var handler = new BulkMoveTasksHandler(_taskItemRepository, _unitOfWork);
        var count = await handler.Handle(
            new BulkMoveTasksCommand(_workspaceId, _projectId, new List<Guid>(), TaskItemStatus.Done),
            CancellationToken.None);

        Assert.Equal(0, count);
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }
}
