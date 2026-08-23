using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.Estimation;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using FluentValidation.TestHelper;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Tasks;

public class TaskEstimationTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;

    public TaskEstimationTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    [InlineData(3)]
    [InlineData(5)]
    [InlineData(8)]
    [InlineData(13)]
    [InlineData(21)]
    public async Task SetEstimation_ShouldAcceptFibonacciPoints(int points)
    {
        var task = TaskItem.Create(_project.Id, "Task", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new SetTaskEstimationCommandHandler(
            _projectRepository, _taskItemRepository, _unitOfWork);
        await handler.Handle(
            new SetTaskEstimationCommand(_workspaceId, _project.Id, task.Id, points),
            CancellationToken.None);

        Assert.Equal(points, task.StoryPoints);
    }

    [Fact]
    public async Task SetEstimation_ShouldClearStoryPoints_WhenNull()
    {
        var task = TaskItem.Create(_project.Id, "Task", null, TaskItemPriority.Medium);
        task.SetStoryPoints(8);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>()).Returns(task);

        var handler = new SetTaskEstimationCommandHandler(
            _projectRepository, _taskItemRepository, _unitOfWork);
        await handler.Handle(
            new SetTaskEstimationCommand(_workspaceId, _project.Id, task.Id, null),
            CancellationToken.None);

        Assert.Null(task.StoryPoints);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(4)]
    [InlineData(-3)]
    [InlineData(100)]
    public void Validator_ShouldRejectNonFibonacciPoints(int points)
    {
        var validator = new SetTaskEstimationCommandValidator();
        var command = new SetTaskEstimationCommand(
            _workspaceId, Guid.NewGuid(), Guid.NewGuid(), points);

        var result = validator.TestValidate(command);
        result.ShouldHaveValidationErrorFor(c => c.StoryPoints);
    }
}
