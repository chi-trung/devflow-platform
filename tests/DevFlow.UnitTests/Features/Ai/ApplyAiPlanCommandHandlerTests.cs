using System.Text.Json;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

public class ApplyAiPlanCommandHandlerTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IAiPlanRepository _aiPlanRepository = Substitute.For<IAiPlanRepository>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly AiPlanApplier _planApplier;

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _userId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;

    public ApplyAiPlanCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Add AI planner", null, TaskItemPriority.High);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>()).Returns(_task);
        _taskItemRepository.GetSubtasksAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        _planApplier = new AiPlanApplier(_taskItemRepository, _unitOfWork);
    }

    private ApplyAiPlanCommandHandler BuildHandler() => new(
        _projectRepository,
        _taskItemRepository,
        _aiPlanRepository,
        _planApplier);

    private AiPlan CreatePendingPlan()
    {
        var subtasksJson = JsonSerializer.Serialize(new[]
        {
            new { title = "Subtask 1", description = "Do it", priority = "High" },
            new { title = "Subtask 2", description = "No desc", priority = "Weird" },
        });
        return AiPlan.Create(
            _project.Id,
            _task.Id,
            _userId,
            _workspaceId,
            "Break down",
            JsonSerializer.Serialize(new[] { "Step 1" }),
            subtasksJson,
            JsonSerializer.Serialize(new[] { "Tests pass" }));
    }

    [Fact]
    public async Task Handle_ShouldCreateSubtasks_AndSetDoD_AndMarkApplied()
    {
        var plan = CreatePendingPlan();
        _aiPlanRepository.GetByIdAsync(plan.Id, Arg.Any<CancellationToken>()).Returns(plan);
        _aiPlanRepository.GetPendingForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<AiPlan>());

        var handler = BuildHandler();
        var response = await handler.Handle(
            new ApplyAiPlanCommand(_workspaceId, _project.Id, plan.Id),
            CancellationToken.None);

        Assert.True(response.Applied);
        Assert.Equal(AiPlanStatus.Applied, plan.Status);
        Assert.Equal("Tests pass", _task.DefinitionOfDone);

        await _taskItemRepository.Received(2).AddAsync(
            Arg.Is<TaskItem>(subtask => subtask.ParentTaskId == _task.Id),
            Arg.Any<CancellationToken>());
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldFallbackToMediumPriority_ForUnknownPriority()
    {
        var plan = CreatePendingPlan();
        _aiPlanRepository.GetByIdAsync(plan.Id, Arg.Any<CancellationToken>()).Returns(plan);
        _aiPlanRepository.GetPendingForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<AiPlan>());

        var handler = BuildHandler();
        await handler.Handle(
            new ApplyAiPlanCommand(_workspaceId, _project.Id, plan.Id),
            CancellationToken.None);

        await _taskItemRepository.Received(2).AddAsync(
            Arg.Is<TaskItem>(subtask =>
                subtask.Title == "Subtask 1" && subtask.Priority == TaskItemPriority.High ||
                subtask.Title == "Subtask 2" && subtask.Priority == TaskItemPriority.Medium),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldSkipSubtasks_ThatAlreadyExist()
    {
        var plan = CreatePendingPlan();
        _aiPlanRepository.GetByIdAsync(plan.Id, Arg.Any<CancellationToken>()).Returns(plan);
        _aiPlanRepository.GetPendingForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<AiPlan>());

        var existing = TaskItem.Create(_project.Id, "Subtask 1", null, TaskItemPriority.Low);
        existing.AttachToParent(_task.Id);
        _taskItemRepository.GetSubtasksAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { existing });

        var handler = BuildHandler();
        await handler.Handle(
            new ApplyAiPlanCommand(_workspaceId, _project.Id, plan.Id),
            CancellationToken.None);

        // Only "Subtask 2" is new.
        await _taskItemRepository.Received(1).AddAsync(
            Arg.Is<TaskItem>(subtask => subtask.Title == "Subtask 2"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldThrowConflict_WhenPlanNotPending()
    {
        var plan = CreatePendingPlan();
        plan.MarkApplied();
        _aiPlanRepository.GetByIdAsync(plan.Id, Arg.Any<CancellationToken>()).Returns(plan);

        var handler = BuildHandler();

        await Assert.ThrowsAsync<ConflictException>(() =>
            handler.Handle(new ApplyAiPlanCommand(_workspaceId, _project.Id, plan.Id), CancellationToken.None));
    }

    [Fact]
    public async Task Handle_ShouldSupersedeOtherPendingPlans()
    {
        var plan = CreatePendingPlan();
        var other = CreatePendingPlan();
        _aiPlanRepository.GetByIdAsync(plan.Id, Arg.Any<CancellationToken>()).Returns(plan);
        _aiPlanRepository.GetPendingForTaskAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(new List<AiPlan> { plan, other });

        var handler = BuildHandler();
        await handler.Handle(
            new ApplyAiPlanCommand(_workspaceId, _project.Id, plan.Id),
            CancellationToken.None);

        Assert.Equal(AiPlanStatus.Applied, plan.Status);
        Assert.Equal(AiPlanStatus.Superseded, other.Status);
    }
}
