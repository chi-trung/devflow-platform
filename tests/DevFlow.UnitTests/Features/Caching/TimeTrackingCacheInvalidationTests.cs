using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Tasks.TimeTracking;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression: logging or deleting a time entry writes an ActivityLog row
/// ("logged time on …"), which the dashboard's cached recentActivity slice
/// reads — but CacheInvalidationBehavior and RealtimeBehavior only fire for
/// requests implementing IProjectEvent. Before the fix the commands wrote
/// through the warm dashboard:{workspaceId} cache for its whole TTL, so the
/// activity line appeared nowhere until it expired, while comment/epic/status
/// actions refreshed instantly.
/// </summary>
public class TimeTrackingCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task LogTimeEntryCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new LogTimeEntryCommand(
            Guid.NewGuid(), _projectId, Guid.NewGuid(), 90, null, DateTimeOffset.UtcNow);

        var behavior = new CacheInvalidationBehavior<LogTimeEntryCommand, Guid>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(Guid.NewGuid()), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public async Task DeleteTimeEntryCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new DeleteTimeEntryCommand(Guid.NewGuid(), _projectId, Guid.NewGuid(), Guid.NewGuid());

        var behavior = new CacheInvalidationBehavior<DeleteTimeEntryCommand, Unit>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(Unit.Value), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public async Task TimeTrackingCommands_ShouldNotifyRealtimeProject()
    {
        var notifier = Substitute.For<IRealtimeNotifier>();

        var logBehavior = new RealtimeBehavior<LogTimeEntryCommand, Guid>(notifier);
        await logBehavior.Handle(
            new LogTimeEntryCommand(Guid.NewGuid(), _projectId, Guid.NewGuid(), 45, "work", DateTimeOffset.UtcNow),
            _ => Task.FromResult(Guid.NewGuid()),
            CancellationToken.None);

        var deleteBehavior = new RealtimeBehavior<DeleteTimeEntryCommand, Unit>(notifier);
        await deleteBehavior.Handle(
            new DeleteTimeEntryCommand(Guid.NewGuid(), _projectId, Guid.NewGuid(), Guid.NewGuid()),
            _ => Task.FromResult(Unit.Value),
            CancellationToken.None);

        await notifier.Received(1).NotifyProjectAsync(
            _projectId, nameof(LogTimeEntryCommand), Arg.Any<CancellationToken>());
        await notifier.Received(1).NotifyProjectAsync(
            _projectId, nameof(DeleteTimeEntryCommand), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void TimeTrackingCommands_ShouldNotDoubleLogActivity()
    {
        // The handlers create the ActivityLog row themselves (they need the
        // task title, which the command record cannot know). ActivityVerb
        // must therefore stay "" so ActivityBehavior skips — otherwise every
        // time entry produces two identical activity rows.
        Assert.Equal("", ((IProjectEvent)new LogTimeEntryCommand(
            Guid.NewGuid(), _projectId, Guid.NewGuid(), 30, null, DateTimeOffset.UtcNow)).ActivityVerb);
        Assert.Equal("", ((IProjectEvent)new DeleteTimeEntryCommand(
            Guid.NewGuid(), _projectId, Guid.NewGuid(), Guid.NewGuid())).ActivityVerb);
    }
}
