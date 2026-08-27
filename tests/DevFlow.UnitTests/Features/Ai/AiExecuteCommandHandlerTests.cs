using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Execute;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DevFlow.UnitTests.Features.Ai;

public class AiExecuteCommandHandlerTests
{
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly ITaskItemRepository _taskItemRepository = Substitute.For<ITaskItemRepository>();
    private readonly IEpicRepository _epicRepository = Substitute.For<IEpicRepository>();
    private readonly IUserRepository _userRepository = Substitute.For<IUserRepository>();
    private readonly IAiClient _aiClient = Substitute.For<IAiClient>();
    private readonly ISender _sender = Substitute.For<ISender>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;

    public AiExecuteCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<(Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)>());
    }

    private AiExecuteCommandHandler BuildHandler() => new(
        _workspaceRepository,
        _projectRepository,
        _sprintRepository,
        _taskItemRepository,
        _epicRepository,
        _aiClient,
        new AiActionExecutor(
            _workspaceRepository,
            _projectRepository,
            _sprintRepository,
            _taskItemRepository,
            _epicRepository,
            _userRepository,
            _sender,
            _unitOfWork));

    [Fact]
    public async Task Handle_ShouldReturnFriendlyError_WhenAiRequestTimesOut()
    {
        // The provider client enforces its own timeout; a slow/overloaded model
        // cancels the request. This must surface as a friendly error, not a 500.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync<OperationCanceledException>();

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "Tạo task login", "board"),
            CancellationToken.None);

        Assert.Null(response.Summary);
        Assert.Empty(response.Actions);
        Assert.NotNull(response.Error);
        Assert.Contains("timed out", response.Error);
    }

    [Fact]
    public async Task Handle_ShouldReturnFriendlyError_WhenAiReturns503Overload()
    {
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new InvalidOperationException("AI API error 503: high demand"));

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "Tạo task login", "board"),
            CancellationToken.None);

        Assert.Null(response.Summary);
        Assert.Empty(response.Actions);
        Assert.Contains("503", response.Error);
    }

    [Fact]
    public async Task Handle_ShouldReturnPendingForCreateActions_AndExecuteMutations()
    {
        // create_* actions are proposed to the user (pending). Mutation actions
        // (set_due_date, set_priority, assign_task, assign_to_sprint, add_to_epic)
        // execute immediately.
        var task = TaskItem.Create(_project.Id, "Existing task", null, TaskItemPriority.Medium);
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>())
            .Returns(task);
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem> { task });

        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("""
                {
                  "summary": "Tạo task và cập nhật deadline",
                  "actions": [
                    { "type": "create_task", "title": "Login screen", "priority": "High" },
                    { "type": "set_due_date", "title": "Set deadline", "taskRef": "Existing task", "dueDate": "2026-09-15" }
                  ]
                }
                """);

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "Tạo task login và set deadline cho task cũ", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Equal(2, response.Actions.Count);

        // create_task → pending
        Assert.Equal("create_task", response.Actions[0].Type);
        Assert.Equal("pending", response.Actions[0].Status);
        Assert.Null(response.Actions[0].EntityId);
        Assert.NotNull(response.Actions[0].Contract);

        // set_due_date → success (mutation executes immediately)
        Assert.Equal("set_due_date", response.Actions[1].Type);
        Assert.Equal("success", response.Actions[1].Status);
        Assert.NotNull(response.Actions[1].EntityId);
    }

    [Fact]
    public async Task Handle_ShouldDeferMutation_WhenTargetTaskIsPending()
    {
        // A mutation that references a task the model also proposed to create
        // cannot run — the target does not exist yet. Both are returned as
        // "pending" so the user can accept the create first.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("""
                {
                  "summary": "Tạo task và assign",
                  "actions": [
                    { "type": "create_task", "title": "Login screen", "priority": "High" },
                    { "type": "assign_task", "title": "Assign login", "taskRef": "Login screen", "assignee": "Nguyen Van A" }
                  ]
                }
                """);

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "Tạo task login và assign cho Nguyễn Văn A", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Equal(2, response.Actions.Count);

        // create_task → pending
        Assert.Equal("create_task", response.Actions[0].Type);
        Assert.Equal("pending", response.Actions[0].Status);

        // assign_task → pending (deferred, target task not yet created)
        Assert.Equal("assign_task", response.Actions[1].Type);
        Assert.Equal("pending", response.Actions[1].Status);
        Assert.Contains("Waiting for", response.Actions[1].Message);
    }

    [Fact]
    public async Task Handle_ShouldAddTaskToEpic_WhenModelReturnsAddToEpicAction()
    {
        // NOTE: use _project.Id (the real id on the stubbed Project), not the
        // _projectId field — the two differ, and resolution matches on Id.
        var epic = Epic.Create(_project.Id, "Auth Epic", null);
        var task = TaskItem.Create(_project.Id, "Login screen", null, TaskItemPriority.High);

        _epicRepository.GetForProjectAsync(_project.Id, Arg.Any<CancellationToken>())
            .Returns(new List<Epic> { epic });
        _taskItemRepository.GetByIdAsync(task.Id, Arg.Any<CancellationToken>())
            .Returns(task);

        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                "{\"summary\":\"Thêm task vào epic\"," +
                "\"actions\":[" +
                "{\"type\":\"add_to_epic\",\"title\":\"Thêm vào epic\",\"taskRef\":\"" + task.Id + "\",\"epicRef\":\"Auth Epic\"}" +
                "]}");

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "thêm task login vào epic auth", "epics", EpicId: epic.Id),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Single(response.Actions);
        Assert.Equal("add_to_epic", response.Actions[0].Type);
        Assert.Equal("success", response.Actions[0].Status);
        Assert.Contains("added to epic", response.Actions[0].Message);
        Assert.Equal(task.Id, response.Actions[0].EntityId);
        Assert.Equal(task.EpicId, epic.Id);
    }

    [Fact]
    public async Task Handle_ShouldReturnReply_WhenModelReturnsConversationalReply()
    {
        // A question / greeting is not an action request — the model returns a
        // "reply" field instead of actions. The handler must surface it as a plain
        // text answer with no error and no "no actions" retry.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("""
                {
                  "summary": "",
                  "reply": "Mình đang dùng Gemini 2.0 Flash để xử lý prompt của bạn.",
                  "actions": []
                }
                """);

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "bạn đang sử dụng models gì vậy?", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Empty(response.Actions);
        Assert.Contains("Gemini 2.0 Flash", response.Summary);

        // Reply is returned immediately — no tight retry, so exactly one call.
        await _aiClient.Received(1).ExecuteActionAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldRetryWithTightPrompt_WhenFirstCallTruncates()
    {
        // Large batch request → the model hits MAX_TOKENS mid-JSON, which the
        // client surfaces as AiResponseTruncatedException. The handler re-prompts
        // with a tight cap (≤3 actions) and returns a useful partial result.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                _ => throw new AiResponseTruncatedException("truncated"),
                _ => """
                    {
                      "summary": "Đã tạo 3 task đầu tiên, 9 task còn lại không đủ chỗ.",
                      "actions": [
                        { "type": "create_task", "title": "Login" },
                        { "type": "create_task", "title": "Register" },
                        { "type": "create_task", "title": "Logout" }
                      ]
                    }
                    """);

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "tạo 12 task cho tính năng login", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Equal(3, response.Actions.Count);
        // create_* actions are now proposed as pending, not executed immediately
        Assert.All(response.Actions, action => Assert.Equal("pending", action.Status));
        Assert.Contains("Login", response.Actions[0].Label);
    }

    [Fact]
    public async Task Handle_ShouldRetryWithTightPrompt_WhenFirstCallReturnsEmptyActions()
    {
        // The model returns valid JSON but an empty actions list. Retry once with
        // a tight cap before giving up.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                """{"summary":"(stub)","actions":[]}""",
                """{"summary":"Đã tạo task","actions":[{"type":"create_task","title":"Login"}]}""");

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "tạo task login", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Single(response.Actions);
        Assert.Equal("create_task", response.Actions[0].Type);
        // create_* actions are now proposed as pending
        Assert.Equal("pending", response.Actions[0].Status);
    }

    [Fact]
    public async Task Handle_ShouldNotLoopForever_WhenBothAttemptsReturnEmpty()
    {
        // Both the initial call and the tight retry come back empty. The handler
        // must stop after one retry and surface the friendly error, not loop.
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns(
                """{"summary":"(stub)","actions":[]}""",
                """{"summary":"(stub 2)","actions":[]}""");

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "tạo task login", "board"),
            CancellationToken.None);

        Assert.NotNull(response.Error);
        Assert.Contains("did not return any actions", response.Error);
        Assert.Empty(response.Actions);

        // Exactly two provider calls happened (initial + one tight retry).
        await _aiClient.Received(2).ExecuteActionAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>());
    }
}