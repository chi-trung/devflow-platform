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
        _userRepository,
        _aiClient,
        _sender,
        _unitOfWork);

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
    public async Task Handle_ShouldExecuteActions_WhenAiReturnsValidContract()
    {
        _aiClient.ExecuteActionAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>())
            .Returns("""
                {
                  "summary": "Tạo task mới",
                  "actions": [
                    { "type": "create_task", "title": "Login screen", "priority": "High" }
                  ]
                }
                """);
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(Guid.NewGuid()));
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(Guid.NewGuid()));

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "Tạo task login", "board"),
            CancellationToken.None);

        Assert.NotNull(response.Summary);
        Assert.Single(response.Actions);
        Assert.Equal("create_task", response.Actions[0].Type);
        Assert.Equal("success", response.Actions[0].Status);
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
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(Guid.NewGuid()));

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "tạo 12 task cho tính năng login", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Equal(3, response.Actions.Count);
        Assert.All(response.Actions, action => Assert.Equal("success", action.Status));
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
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(Guid.NewGuid()));

        var handler = BuildHandler();
        var response = await handler.Handle(
            new AiExecuteCommand(_workspaceId, _projectId, "tạo task login", "board"),
            CancellationToken.None);

        Assert.Null(response.Error);
        Assert.Single(response.Actions);
        Assert.Equal("create_task", response.Actions[0].Type);
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
