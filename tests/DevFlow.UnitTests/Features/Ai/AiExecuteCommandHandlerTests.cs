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
}
