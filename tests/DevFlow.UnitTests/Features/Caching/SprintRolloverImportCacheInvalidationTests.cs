using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Import;
using DevFlow.Application.Features.Sprints.Rollover;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression (wave 5b): rollover moves every unfinished task's SprintId and
/// import restores whole task trees, yet neither command implemented
/// IProjectEvent — so for a full 30s TTL the board's cached tasks:{projectId}
/// pages kept showing the PRE-change sprint column state, and realtime
/// NotifyProjectAsync never fired for collaborators. Comment/epic/status
/// commands invalidate instantly; these two silently did not.
/// </summary>
public class SprintRolloverImportCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _projectId = Guid.NewGuid();

    [Fact]
    public async Task RolloverSprintCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new RolloverSprintCommand(Guid.NewGuid(), _projectId, Guid.NewGuid());

        var behavior = new CacheInvalidationBehavior<RolloverSprintCommand, RolloverResult>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(new RolloverResult(0, 0, null)), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public async Task ImportProjectBackupCommand_ShouldInvalidateProjectCacheTag()
    {
        var command = new ImportProjectBackupCommand(Guid.NewGuid(), _projectId, "{}");

        var behavior = new CacheInvalidationBehavior<ImportProjectBackupCommand, ImportBackupResult>(_cache);
        await behavior.Handle(command, _ => Task.FromResult(new ImportBackupResult(0, 0, 0, 0, 0, [])), CancellationToken.None);

        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public async Task BothCommands_ShouldNotifyRealtimeProject()
    {
        var notifier = Substitute.For<IRealtimeNotifier>();

        var rolloverBehavior = new RealtimeBehavior<RolloverSprintCommand, RolloverResult>(notifier);
        await rolloverBehavior.Handle(
            new RolloverSprintCommand(Guid.NewGuid(), _projectId, Guid.NewGuid()),
            _ => Task.FromResult(new RolloverResult(0, 0, null)),
            CancellationToken.None);

        var importBehavior = new RealtimeBehavior<ImportProjectBackupCommand, ImportBackupResult>(notifier);
        await importBehavior.Handle(
            new ImportProjectBackupCommand(Guid.NewGuid(), _projectId, "{}"),
            _ => Task.FromResult(new ImportBackupResult(0, 0, 0, 0, 0, [])),
            CancellationToken.None);

        await notifier.Received(1).NotifyProjectAsync(
            _projectId, nameof(RolloverSprintCommand), Arg.Any<CancellationToken>());
        await notifier.Received(1).NotifyProjectAsync(
            _projectId, nameof(ImportProjectBackupCommand), Arg.Any<CancellationToken>());
    }

    [Fact]
    public void BothCommands_ShouldNotDoubleLogActivity()
    {
        // Rollover writes a precise per-task ActivityLog row itself (it knows
        // the source sprint name the command cannot carry); import bulk-restores
        // whole trees where a row per task would flood the feed. Both must keep
        // the default empty verb so ActivityBehavior skips.
        Assert.Equal("", ((IProjectEvent)new RolloverSprintCommand(
            Guid.NewGuid(), _projectId, Guid.NewGuid())).ActivityVerb);
        Assert.Equal("", ((IProjectEvent)new ImportProjectBackupCommand(
            Guid.NewGuid(), _projectId, "{}")).ActivityVerb);
    }
}
