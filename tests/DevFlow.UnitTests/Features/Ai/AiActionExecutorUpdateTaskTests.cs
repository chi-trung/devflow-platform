using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Execute;
using DevFlow.Application.Features.Tasks.Update;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

/// <summary>
/// The dispatcher in ExecuteActionAsync routes action.Type case-insensitively,
/// but UpdateTaskAsync's field-selection ternaries historically compared the
/// RAW string — a model returning "Set_Due_Date" or " ASSIGN_TASK" was routed
/// in correctly, then silently rewrote the task's existing values and
/// reported success (the bug family's no-crash / no-op signature).
/// </summary>
public class AiActionExecutorUpdateTaskTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly TaskItem _task;
    private readonly AiActionExecutor _executor;

    public AiActionExecutorUpdateTaskTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _task = TaskItem.Create(_project.Id, "Harden auth", null, TaskItemPriority.Medium);

        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
        _taskItemRepository.GetByIdAsync(_task.Id, Arg.Any<CancellationToken>())
            .Returns(_task);

        _executor = new AiActionExecutor(
            _workspaceRepository,
            _projectRepository,
            _sprintRepository,
            _taskItemRepository,
            _epicRepository,
            _userRepository,
            _sender,
            _unitOfWork);
    }

    private Task<ExecutedAction> Execute(AiExecuteActionContract action) =>
        _executor.ExecuteActionAsync(_workspaceId, _project.Id, action, CancellationToken.None);

    [Fact]
    public async Task SetDueDate_DriftingCasing_ShouldStillWriteNewDueDate()
    {
        // "Set_Due_Date" survives the normalized dispatch but used to fail
        // every raw comparison below it → silent no-op reported as success.
        var result = await Execute(new AiExecuteActionContract
        {
            Type = "Set_Due_Date",
            TaskRef = _task.Id.ToString(),
            DueDate = "2026-10-01",
        });

        Assert.Equal("success", result.Status);
        await _sender.Received(1).Send(
            Arg.Is<UpdateTaskItemCommand>(c =>
                c.TaskId == _task.Id &&
                c.DueDateUtc == new DateTimeOffset(2026, 10, 1, 0, 0, 0, TimeSpan.Zero)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task SetPriority_WithWhitespace_ShouldStillWriteNewPriority()
    {
        var result = await Execute(new AiExecuteActionContract
        {
            Type = "  set_priority  ",
            TaskRef = _task.Id.ToString(),
            Priority = "Critical",
        });

        Assert.Equal("success", result.Status);
        await _sender.Received(1).Send(
            Arg.Is<UpdateTaskItemCommand>(c =>
                c.TaskId == _task.Id && c.Priority == TaskItemPriority.Critical),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AssignTask_MixedCase_ShouldNotMasqueradeAsAssignmentMessage()
    {
        // Before the fix, a drifted "SET_PRIORITY" fell through the message
        // switch to the assign default ("Task … assigned.") even though it
        // never assigned anyone.
        var result = await Execute(new AiExecuteActionContract
        {
            Type = "SET_PRIORITY",
            TaskRef = _task.Id.ToString(),
            Priority = "Low",
        });

        Assert.Equal("success", result.Status);
        Assert.Contains("Priority", result.Message);
        Assert.DoesNotContain("assigned", result.Message);
        await _sender.Received(1).Send(
            Arg.Is<UpdateTaskItemCommand>(c => c.Priority == TaskItemPriority.Low),
            Arg.Any<CancellationToken>());
    }
}
