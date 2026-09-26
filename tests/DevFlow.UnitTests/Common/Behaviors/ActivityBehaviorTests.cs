using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace DevFlow.UnitTests.Common.Behaviors;

/// <summary>
/// Stands in for a project-scoped command. Public at the top level rather than
/// nested, because NSubstitute has to build a Castle proxy over
/// <c>ILogger&lt;ActivityBehavior&lt;TestCommand, string&gt;&gt;</c> and a proxy
/// cannot be generated for a private type.
/// </summary>
public sealed record TestCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid? TaskId,
    string Verb,
    string Label) : IRequest<string>, IWorkspaceRequest, IProjectEvent, IActivityLabelSink
{
    public Guid? ActivityTaskId => TaskId;

    public string ActivityVerb => Verb;

    public string ActivityLabel => Label;

    public string? ResolvedActivityLabel { get; set; }
}

/// <summary>
/// Every command that implements <see cref="IProjectEvent"/> gets its activity
/// row written here, after the handler succeeds. That is a single choke point
/// for a whole feed, so the rules it enforces are worth pinning down: a command
/// with no verb stays silent, a label the handler could not know at
/// construction wins over the placeholder the command carries, and a failure to
/// record must never take the command down with it.
/// </summary>
public class ActivityBehaviorTests
{
    private readonly IActivityLogRepository _activityLog = Substitute.For<IActivityLogRepository>();
    private readonly IUserContext _userContext = Substitute.For<IUserContext>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();
    private readonly ILogger<ActivityBehavior<TestCommand, string>> _logger =
        Substitute.For<ILogger<ActivityBehavior<TestCommand, string>>>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Guid _projectId = Guid.NewGuid();
    private readonly Guid _taskId = Guid.NewGuid();
    private readonly Guid _actorId = Guid.NewGuid();

    public ActivityBehaviorTests()
    {
        _userContext.UserId.Returns(_actorId);
    }

    private ActivityBehavior<TestCommand, string> CreateBehavior() =>
        new(_activityLog, _userContext, _unitOfWork, _logger);

    private TestCommand CreateCommand(
        string verb = "created task",
        string label = "Ship the thing") =>
        new(_workspaceId, _projectId, _taskId, verb, label);

    [Fact]
    public async Task ShouldWriteOneEntry_WhenCommandCarriesAVerb()
    {
        var behavior = CreateBehavior();

        var response = await behavior.Handle(CreateCommand(), _ => Task.FromResult("ok"), CancellationToken.None);

        Assert.Equal("ok", response);
        await _activityLog.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log =>
                log.Action == "created task" &&
                log.Target == "Ship the thing" &&
                log.WorkspaceId == _workspaceId &&
                log.ProjectId == _projectId &&
                log.TaskItemId == _taskId &&
                log.ActorUserId == _actorId),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldStaySilent_WhenVerbIsEmpty()
    {
        // UpdateTaskItemCommand relies on this: it writes its own, more specific
        // rows, and an automatic "updated task" would only add a content-free
        // duplicate to a five-row feed.
        var behavior = CreateBehavior();

        await behavior.Handle(CreateCommand(verb: ""), _ => Task.FromResult("ok"), CancellationToken.None);

        await _activityLog.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldPreferTheResolvedLabel_OverTheCommandsPlaceholder()
    {
        // A delete or a detach only ever holds an id in the command. The handler
        // loads the entity and sets this; without it the feed shows a GUID, or
        // worse, "a task".
        var behavior = CreateBehavior();
        var command = CreateCommand(label: "a task");
        command.ResolvedActivityLabel = "Fix the retry queue";

        await behavior.Handle(command, _ => Task.FromResult("ok"), CancellationToken.None);

        await _activityLog.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Target == "Fix the retry queue"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldFallBackToTheCommandLabel_WhenNothingWasResolved()
    {
        var behavior = CreateBehavior();

        await behavior.Handle(CreateCommand(), _ => Task.FromResult("ok"), CancellationToken.None);

        await _activityLog.Received(1).AddAsync(
            Arg.Is<ActivityLog>(log => log.Target == "Ship the thing"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ShouldReturnTheResponse_EvenWhenRecordingFails()
    {
        // The command already did its work and committed. Failing the whole
        // request because a history row could not be written would report a
        // failure for something that succeeded.
        var behavior = CreateBehavior();
        _activityLog.AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>())
            .Returns<Task>(_ => throw new InvalidOperationException("activity table is down"));

        var response = await behavior.Handle(CreateCommand(), _ => Task.FromResult("ok"), CancellationToken.None);

        Assert.Equal("ok", response);
    }

    [Fact]
    public async Task ShouldNotWriteAnything_WhenRequestIsNotAProjectEvent()
    {
        var logger = Substitute.For<ILogger<ActivityBehavior<string, string>>>();
        var behavior = new ActivityBehavior<string, string>(_activityLog, _userContext, _unitOfWork, logger);

        await behavior.Handle("ping", _ => Task.FromResult("ok"), CancellationToken.None);

        await _activityLog.DidNotReceive().AddAsync(Arg.Any<ActivityLog>(), Arg.Any<CancellationToken>());
    }
}
