using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Ai.Execute;
using DevFlow.Application.Features.Tasks.Create;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Ai;

/// <summary>
/// Tests for the confirm pipeline: when the user presses Accept on a pending
/// action, the confirm command re-runs that single action through the shared
/// AiActionExecutor and broadcasts the realtime event.
/// </summary>
public class AiExecuteConfirmCommandHandlerTests
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
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Project _project;

    public AiExecuteConfirmCommandHandlerTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _projectRepository.GetForWorkspaceAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<Project> { _project });
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new List<(Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)>());
    }

    private AiExecuteConfirmCommandHandler BuildHandler() => new(
        new AiActionExecutor(
            _workspaceRepository,
            _projectRepository,
            _sprintRepository,
            _taskItemRepository,
            _epicRepository,
            _userRepository,
            _sender,
            _unitOfWork),
        _realtimeNotifier);

    [Fact]
    public async Task Handle_ShouldExecuteSingleAction_WhenUserAccepts()
    {
        // A create_task accepted from the review list runs immediately and
        // returns a success with the new task's id.
        var taskId = Guid.NewGuid();
        _sender.Send(Arg.Any<IRequest<TaskItemCreatedResponse>>(), Arg.Any<CancellationToken>())
            .Returns(new TaskItemCreatedResponse(taskId));

        var handler = BuildHandler();
        var result = await handler.Handle(
            new AiExecuteConfirmCommand(
                _workspaceId,
                _projectId,
                new AiExecuteActionContract
                {
                    Type = "create_task",
                    Title = "Login screen",
                    Priority = "High",
                }),
            CancellationToken.None);

        Assert.Equal("create_task", result.Type);
        Assert.Equal("success", result.Status);
        Assert.Equal(taskId, result.EntityId);
        Assert.Null(result.Contract);

        // The unit of work committed (the executor saves internally).
        await _unitOfWork.Received(1).SaveChangesAsync(Arg.Any<CancellationToken>());

        // Realtime broadcast fired so other connected clients refresh.
        await _realtimeNotifier.Received(1).NotifyProjectAsync(
            _projectId,
            "create_task",
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Handle_ShouldReturnFailed_WhenTaskNotFound()
    {
        // Accepting a mutation whose target task no longer exists must surface
        // as a friendly failure, not throw.
        _taskItemRepository.GetForProjectAsync(_project.Id, null, Arg.Any<CancellationToken>())
            .Returns(new List<TaskItem>());

        var handler = BuildHandler();
        var result = await handler.Handle(
            new AiExecuteConfirmCommand(
                _workspaceId,
                _projectId,
                new AiExecuteActionContract
                {
                    Type = "set_due_date",
                    Title = "Set deadline",
                    TaskRef = "Ghost task",
                    DueDate = "2026-09-15",
                }),
            CancellationToken.None);

        Assert.Equal("set_due_date", result.Type);
        Assert.Equal("failed", result.Status);
        Assert.NotNull(result.Message);
    }
}
