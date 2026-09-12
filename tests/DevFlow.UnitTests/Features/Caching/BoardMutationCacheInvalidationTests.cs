using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.BulkOperations;
using DevFlow.Application.Features.Tasks.Reorder;
using DevFlow.Domain.Enums;
using MediatR;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Caching;

/// <summary>
/// Regression: reorder and bulk ops mutate the exact fields the board's
/// cached tasks payload embeds (Position, Status, AssigneeId, existence),
/// but only requests implementing IProjectEvent get their project cache tag
/// dropped by CacheInvalidationBehavior. Before the fix these commands
/// wrote through the cache silently — the reload after a successful drag or
/// bulk call re-read the warm cache and the board reverted for up to 30s.
/// </summary>
public class BoardMutationCacheInvalidationTests
{
    private readonly ICacheService _cache = Substitute.For<ICacheService>();
    private readonly Guid _projectId = Guid.NewGuid();

    private async Task AssertInvalidates<TRequest, TResponse>(TRequest command, TResponse result)
        where TRequest : notnull
        where TResponse : notnull
    {
        var behavior = new CacheInvalidationBehavior<TRequest, TResponse>(_cache);
        await behavior.Handle(command, (_ => Task.FromResult(result)), CancellationToken.None);
        await _cache.Received(1).RemoveByTagAsync($"project:{_projectId}");
    }

    [Fact]
    public Task ReorderTasksCommand_ShouldInvalidateProjectCacheTag() =>
        AssertInvalidates(
            new ReorderTasksCommand(Guid.NewGuid(), _projectId, Array.Empty<ReorderTaskItem>()),
            Unit.Value);

    [Fact]
    public Task BulkMoveTasksCommand_ShouldInvalidateProjectCacheTag() =>
        AssertInvalidates(
            new BulkMoveTasksCommand(Guid.NewGuid(), _projectId, new List<Guid>(), TaskItemStatus.Done),
            0);

    [Fact]
    public Task BulkAssignTasksCommand_ShouldInvalidateProjectCacheTag() =>
        AssertInvalidates(
            new BulkAssignTasksCommand(Guid.NewGuid(), _projectId, new List<Guid>(), Guid.NewGuid()),
            0);

    [Fact]
    public Task BulkDeleteTasksCommand_ShouldInvalidateProjectCacheTag() =>
        AssertInvalidates(
            new BulkDeleteTasksCommand(Guid.NewGuid(), _projectId, new List<Guid>()),
            0);

    [Fact]
    public void BoardMutations_ShouldNotLogActivity()
    {
        // ActivityVerb defaults to "" so ActivityBehavior skips them — these
        // are positional/drag ops where a per-row activity entry is noise.
        Assert.Equal("", ((IProjectEvent)new ReorderTasksCommand(
            Guid.NewGuid(), _projectId, Array.Empty<ReorderTaskItem>())).ActivityVerb);
        Assert.Equal("", ((IProjectEvent)new BulkDeleteTasksCommand(
            Guid.NewGuid(), _projectId, new List<Guid>())).ActivityVerb);
    }
}
