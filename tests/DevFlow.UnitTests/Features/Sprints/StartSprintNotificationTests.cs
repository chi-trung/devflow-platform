using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Application.Features.Sprints.Start;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Sprints;

public class StartSprintNotificationTests
{
    private readonly IProjectRepository _projectRepository = Substitute.For<IProjectRepository>();
    private readonly ISprintRepository _sprintRepository = Substitute.For<ISprintRepository>();
    private readonly IWorkspaceRepository _workspaceRepository = Substitute.For<IWorkspaceRepository>();
    private readonly INotificationRepository _notificationRepository = Substitute.For<INotificationRepository>();
    private readonly INotificationPreferencesRepository _preferencesRepository = Substitute.For<INotificationPreferencesRepository>();
    private readonly IRealtimeNotificationService _realtimeService = Substitute.For<IRealtimeNotificationService>();
    private readonly IEmailService _emailService = Substitute.For<IEmailService>();
    private readonly IOutboxDispatcher _outboxDispatcher = Substitute.For<IOutboxDispatcher>();
    private readonly IUnitOfWork _unitOfWork = Substitute.For<IUnitOfWork>();

    private readonly Guid _workspaceId = Guid.NewGuid();
    private readonly Project _project;
    private readonly Sprint _sprint;

    private readonly (Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role) _member1;
    private readonly (Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role) _member2;

    public StartSprintNotificationTests()
    {
        _project = Project.Create(_workspaceId, "DevFlow Core", "DEV", null);
        _sprint = Sprint.Create(_project.Id, "Sprint 22", "Notifications");

        _member1 = (Guid.NewGuid(), "alice@devflow.local", "alice", "Alice", WorkspaceRole.Member);
        _member2 = (Guid.NewGuid(), "bob@devflow.local", "bob", "Bob", WorkspaceRole.Member);

        _projectRepository.GetByIdAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(_project);
        _sprintRepository.GetByIdAsync(_sprint.Id, Arg.Any<CancellationToken>()).Returns(_sprint);
        _sprintRepository.HasActiveSprintAsync(_project.Id, Arg.Any<CancellationToken>()).Returns(false);
    }

    private StartSprintCommandHandler CreateHandler() =>
        new(_projectRepository, _sprintRepository, _workspaceRepository,
            _notificationRepository, _preferencesRepository, _realtimeService,
            _emailService, _outboxDispatcher, _unitOfWork);

    private StartSprintCommand CreateCommand() =>
        new(_workspaceId, _project.Id, _sprint.Id,
            DateTimeOffset.UtcNow, DateTimeOffset.UtcNow.AddDays(14));

    [Fact]
    public async Task Start_ShouldPersistNotificationForEachMember()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { _member1, _member2 });

        var handler = CreateHandler();
        await handler.Handle(CreateCommand(), CancellationToken.None);

        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == _member1.UserId &&
                n.Type == "SprintStarted" &&
                n.ProjectId == _project.Id),
            Arg.Any<CancellationToken>());
        await _notificationRepository.Received(1).AddAsync(
            Arg.Is<Notification>(n =>
                n.UserId == _member2.UserId &&
                n.Type == "SprintStarted" &&
                n.ProjectId == _project.Id),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Start_ShouldSendEmail_WhenPrefsAllow()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { _member1 });
        _preferencesRepository.GetByUserIdAsync(_member1.UserId, Arg.Any<CancellationToken>())
            .Returns((NotificationPreferences?)null); // null = defaults allow

        var handler = CreateHandler();
        await handler.Handle(CreateCommand(), CancellationToken.None);

        await _emailService.Received(1).SendSprintStartedEmailAsync(
            _member1.Email,
            _sprint.Name,
            _project.Name,
            _workspaceId.ToString(),
            _project.Id.ToString(),
            _sprint.Id.ToString());
    }

    [Fact]
    public async Task Start_ShouldSkipEmail_WhenEmailOnSprintStartedDisabled()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(new[] { _member1 });

        var prefs = NotificationPreferences.Create(_member1.UserId);
        prefs.EmailOnSprintStarted = false;
        _preferencesRepository.GetByUserIdAsync(_member1.UserId, Arg.Any<CancellationToken>())
            .Returns(prefs);

        var handler = CreateHandler();
        await handler.Handle(CreateCommand(), CancellationToken.None);

        await _emailService.DidNotReceive().SendSprintStartedEmailAsync(
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(),
            Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>());
    }

    [Fact]
    public async Task Start_ShouldEnqueueOutboxWebhookEvent()
    {
        _workspaceRepository.GetMembersAsync(_workspaceId, Arg.Any<CancellationToken>())
            .Returns(Array.Empty<(Guid, string, string, string, WorkspaceRole)>());

        var handler = CreateHandler();
        await handler.Handle(CreateCommand(), CancellationToken.None);

        await _outboxDispatcher.Received(1).EnqueueAsync(
            "webhook.sprint.started",
            Arg.Any<object>(),
            Arg.Any<CancellationToken>());
    }
}
