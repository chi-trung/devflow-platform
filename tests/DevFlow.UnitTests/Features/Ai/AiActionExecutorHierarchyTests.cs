using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Execute;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Application.Features.Tasks.Subtasks;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

/// <summary>
/// Tests for the AI hierarchy enforcement: a subtask can only be created under a
/// top-level task (Epic → Task → Subtask). These cover the pre-execution guard
/// in the executor (which resolves the parent only among top-level tasks and
/// fails fast when a subtask title is matched), the structured error data the
/// confirm handler surfaces, and the "no duplicates on retry" recovery path.
/// </summary>
public class AiActionExecutorHierarchyTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly IRealtimeNotifier _realtimeNotifier = Substitute.For<IRealtimeNotifier>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly AiActionExecutor _executor;
    private readonly AiExecuteConfirmCommandHandler _confirmHandler;

    public AiActionExecutorHierarchyTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<(Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)>());

        _executor = new AiActionExecutor(
            _workspaceRepository,
            _projectRepository,
            _sprintRepository,
            _taskItemRepository,
            _epicRepository,
            _userRepository,
            _sender,
            _unitOfWork);
        _confirmHandler = new AiExecuteConfirmCommandHandler(_executor, _realtimeNotifier);
    }

    private AiExecuteActionContract SubtaskAction(string title, string parentRef) => new()
    {
        Type = "create_subtask",
        Title = title,
        ParentTaskRef = parentRef,
    };

    private Task<ExecutedAction> Confirm(AiExecuteActionContract action) =>
        _confirmHandler.Handle(
            new AiExecuteConfirmCommand(_workspaceId, _project.Id, action),
            CancellationToken.None);

    [Fact]
    public async Task CreateSubtask_ShouldSucceed_WhenParentIsTopLevelTask()
    {
        // Epic → Task → Subtask is valid: a top-level task may carry children.
        var parent = TaskItem.Create(_project.Id, "Login screen", null, TaskItemPriority.High);
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { parent });
        _sender.Send(Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new SubtaskCreatedResponse(Guid.NewGuid(), parent.Id));

        var result = await Confirm(SubtaskAction("Forgot password", "Login"));

        Assert.Equal("success", result.Status);
        Assert.Null(result.Error);
        await _sender.Received(1).Send(
            Arg.Is<IRequest<SubtaskCreatedResponse>>(cmd => MatchesSubtaskCreate(cmd, parent.Id, "Forgot password")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtask_ShouldFailWithStructuredError_WhenParentIsSubtask()
    {
        // Subtask → Subtask is invalid. The confirm handler must surface a failed
        // action with structured detail (parent id, actual vs. required type,
        // recovery hint) — and the executor must not have sent any command.
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        subtask.AttachToParent(root.Id);

        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { root, subtask });

        var result = await Confirm(SubtaskAction("Grandchild", "Child"));

        Assert.Equal("failed", result.Status);
        Assert.NotNull(result.Error);
        Assert.Equal("hierarchy_violation", result.Error.Code);
        Assert.Equal(subtask.Id, result.Error.ParentId);
        Assert.Equal("Subtask", result.Error.ActualType);
        Assert.Equal("Task", result.Error.RequiredType);
        Assert.Contains("top-level task", result.Error.RecoveryHint);
        Assert.Contains(root.Id.ToString(), result.Error.RecoveryHint);

        // No mutation was attempted — the guard fired before the command.
        await _sender.DidNotReceiveWithAnyArgs().Send(
            Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtask_ShouldFailWithStructuredError_WhenParentRefIsExplicitSubtaskId()
    {
        // Even an explicit subtask id must be rejected as a parent.
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        subtask.AttachToParent(root.Id);

        _taskItemRepository.GetByIdAsync(subtask.Id, Arg.Any<CancellationToken>())
            .Returns(subtask);

        var result = await Confirm(SubtaskAction("Grandchild", subtask.Id.ToString()));

        Assert.Equal("failed", result.Status);
        Assert.Equal("hierarchy_violation", result.Error?.Code);
        Assert.Equal(subtask.Id, result.Error?.ParentId);
        Assert.Equal("Task", result.Error?.RequiredType);

        await _sender.DidNotReceiveWithAnyArgs().Send(
            Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtask_ShouldPreferTopLevelTask_WhenNamesCollide()
    {
        // A task and a subtask share the same title. Resolution must prefer the
        // top-level task (the only valid parent) instead of matching the subtask.
        var task = TaskItem.Create(_project.Id, "Payment", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Payment", null, TaskItemPriority.Medium);
        subtask.AttachToParent(task.Id);

        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task, subtask });
        _sender.Send(Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new SubtaskCreatedResponse(Guid.NewGuid(), task.Id));

        var result = await Confirm(SubtaskAction("Refund", "Payment"));

        Assert.Equal("success", result.Status);
        Assert.Null(result.Error);
        await _sender.Received(1).Send(
            Arg.Is<IRequest<SubtaskCreatedResponse>>(cmd => MatchesSubtaskCreate(cmd, task.Id, "Refund")),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task CreateSubtask_ShouldFailAsNotFound_WhenNoMatchingParentExists()
    {
        // No task matches the requested parent — the handler reports a plain
        // not-found (no structured hierarchy error), and no mutation is attempted.
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var result = await Confirm(SubtaskAction("Ghost child", "No such task"));

        Assert.Equal("failed", result.Status);
        Assert.Null(result.Error);
        await _sender.DidNotReceiveWithAnyArgs().Send(
            Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ExecuteAsync_ShouldFailHierarchyAction_ButStillRunSiblingActions()
    {
        // Partial failure: one create_subtask targets a subtask while a sibling
        // create_task is valid. The hierarchy action fails with structured detail
        // while the valid action still succeeds — one bad action never cancels
        // the rest.
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        subtask.AttachToParent(root.Id);

        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { root, subtask });
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(Guid.NewGuid()));

        var subtaskResult = await Confirm(SubtaskAction("Bad grandchild", "Child"));
        var taskResult = await Confirm(
            new AiExecuteActionContract { Type = "create_task", Title = "Login screen", Priority = "High" });

        Assert.Equal("failed", subtaskResult.Status);
        Assert.Equal("hierarchy_violation", subtaskResult.Error?.Code);

        Assert.Equal("success", taskResult.Status);
        Assert.Null(taskResult.Error);
    }

    [Fact]
    public async Task CreateSubtask_ShouldNotCreateDuplicate_WhenRetriedAfterFailure()
    {
        // Recovery path: the AI must not re-run a rejected action and create a
        // duplicate. When a hierarchy-violating parent is retried, the guard
        // fires again and no command is ever sent — the rejected action is
        // idempotent because it never mutates.
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        subtask.AttachToParent(root.Id);

        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { root, subtask });

        var action = SubtaskAction("Grandchild", "Child");
        var first = await Confirm(action);
        var second = await Confirm(action);

        Assert.Equal("failed", first.Status);
        Assert.Equal("failed", second.Status);

        // Never sent, so no duplicate can be created — regardless of retries.
        await _sender.DidNotReceiveWithAnyArgs().Send(
            Arg.Any<IRequest<SubtaskCreatedResponse>>(), Arg.Any<CancellationToken>());
        await _unitOfWork.DidNotReceiveWithAnyArgs().SaveChangesAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Executor_ShouldThrowHierarchyException_OnDirectViolation()
    {
        // The executor-level guard throws before any mutation. The handlers are
        // what convert that into a structured failed result.
        var root = TaskItem.Create(_project.Id, "Root", null, TaskItemPriority.Medium);
        var subtask = TaskItem.Create(_project.Id, "Child", null, TaskItemPriority.Medium);
        subtask.AttachToParent(root.Id);

        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { root, subtask });

        var ex = await Assert.ThrowsAsync<InvalidHierarchyException>(() =>
            _executor.ExecuteActionAsync(
                _workspaceId,
                _project.Id,
                SubtaskAction("Grandchild", "Child"),
                CancellationToken.None));

        Assert.Equal(subtask.Id, ex.ParentId);
        Assert.Equal("Subtask", ex.ActualParentType);
        Assert.Equal("Task", ex.RequiredParentType);
        Assert.Contains(root.Id.ToString(), ex.RecoveryHint);
    }

    [Fact]
    public void IsCreateAction_ShouldFlagCreateSubtask()
    {
        Assert.True(AiActionExecutor.IsCreateAction("create_subtask"));
        Assert.True(AiActionExecutor.IsCreateAction("create_task"));
        Assert.False(AiActionExecutor.IsCreateAction("set_due_date"));
        Assert.False(AiActionExecutor.IsCreateAction("assign_task"));
    }

    /// <summary>
    /// NSubstitute's Arg.Is matcher is an expression tree, so it cannot contain
    /// an `is` pattern. This plain predicate does the same work in compilable
    /// form: the sent request must be a CreateSubtaskCommand for the expected
    /// parent with the expected title.
    /// </summary>
    private static bool MatchesSubtaskCreate(IRequest<SubtaskCreatedResponse> cmd, Guid parentId, string title)
    {
        var create = cmd as CreateSubtaskCommand;
        return create is not null
            && create.ParentTaskId == parentId
            && create.Title == title;
    }
}
