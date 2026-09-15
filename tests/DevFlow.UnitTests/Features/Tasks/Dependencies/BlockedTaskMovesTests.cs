using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Features.Tasks.Dependencies;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Xunit;

namespace DevFlow.UnitTests.Features.Tasks.Dependencies;

/// <summary>
/// The evaluation is a pure function over (edges, status lookup), so these
/// tests pin the exact exemption semantics the write-path guards and the
/// graph endpoint share.
/// </summary>
public class BlockedTaskMovesTests
{
    private static readonly Guid Blocked = Guid.Parse("11111111-1111-1111-1111-111111111111");
    private static readonly Guid Blocker = Guid.Parse("22222222-2222-2222-2222-222222222222");

    private static TaskDependency Edge(Guid blocked, Guid blocker) =>
        TaskDependency.Create(blocked, blocker);

    private static TaskStatusSnapshot Snap(Guid id, string title, TaskItemStatus status) =>
        new(id, title, status);

    private static Func<Guid, TaskItemStatus?> Statuses(params TaskStatusSnapshot[] snapshots)
    {
        var byId = snapshots.ToDictionary(s => s.Id);
        return id => byId.TryGetValue(id, out var s) ? s.Status : null;
    }

    [Fact]
    public void Evaluate_NonDoneBlocker_IsUnresolved()
    {
        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(Blocked, Blocker) },
            Statuses(Snap(Blocked, "B", TaskItemStatus.Ready), Snap(Blocker, "X", TaskItemStatus.InProgress)));

        Assert.True(ev.UnresolvedBlockersByTaskId.ContainsKey(Blocked));
        Assert.Equal(new[] { Blocker }, ev.UnresolvedBlockersByTaskId[Blocked]);
    }

    [Fact]
    public void Evaluate_DoneBlocker_IsExempt()
    {
        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(Blocked, Blocker) },
            Statuses(Snap(Blocked, "B", TaskItemStatus.Ready), Snap(Blocker, "X", TaskItemStatus.Done)));

        Assert.Empty(ev.UnresolvedBlockersByTaskId);
    }

    [Fact]
    public void Evaluate_MissingBlockerStatus_IsExempt()
    {
        // Soft-deleted or far-project blocker: nothing in the project can
        // resolve it, so it must not lock the blocked task either.
        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(Blocked, Blocker) },
            Statuses(Snap(Blocked, "B", TaskItemStatus.Ready)));

        Assert.Empty(ev.UnresolvedBlockersByTaskId);
    }

    [Fact]
    public void Evaluate_CyclicPair_IsExempt()
    {
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();

        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(a, b), Edge(b, a) },
            Statuses(Snap(a, "A", TaskItemStatus.Planning), Snap(b, "B", TaskItemStatus.Planning)));

        Assert.Empty(ev.UnresolvedBlockersByTaskId);
        Assert.Equal(2, ev.CyclicNodeIds.Count);
    }

    [Fact]
    public void Evaluate_CycleMemberWithExternalBlocker_IsStillBlocked()
    {
        // Exemption covers the cycle edge only. A task in a cycle that also
        // waits on a non-cycle blocker is still blocked by that one.
        var a = Guid.NewGuid();
        var b = Guid.NewGuid();
        var external = Guid.NewGuid();

        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(a, b), Edge(b, a), Edge(a, external) },
            Statuses(
                Snap(a, "A", TaskItemStatus.Planning),
                Snap(b, "B", TaskItemStatus.Planning),
                Snap(external, "E", TaskItemStatus.Ready)));

        Assert.False(ev.UnresolvedBlockersByTaskId.ContainsKey(b));
        Assert.Equal(new[] { external }, ev.UnresolvedBlockersByTaskId[a]);
    }

    [Fact]
    public void Evaluate_DuplicateEdges_ListBlockerOnce()
    {
        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(Blocked, Blocker), Edge(Blocked, Blocker) },
            Statuses(Snap(Blocked, "B", TaskItemStatus.Ready), Snap(Blocker, "X", TaskItemStatus.Planning)));

        Assert.Single(ev.UnresolvedBlockersByTaskId[Blocked]);
    }

    [Fact]
    public void ThrowIfBlocked_NoBlockers_DoesNotThrow()
    {
        var ev = BlockedTaskMoves.Evaluate(new List<TaskDependency>(), Statuses());
        BlockedTaskMoves.ThrowIfBlocked(ev, Blocked, "B", _ => null);
    }

    [Fact]
    public void ThrowIfBlocked_NamesUpToThreeBlockers()
    {
        var b1 = Guid.NewGuid();
        var b2 = Guid.NewGuid();
        var b3 = Guid.NewGuid();
        var b4 = Guid.NewGuid();
        var names = new Dictionary<Guid, string> { [b1] = "One", [b2] = "Two", [b3] = "Three", [b4] = "Four" };
        var edges = new List<TaskDependency> { Edge(Blocked, b1), Edge(Blocked, b2), Edge(Blocked, b3), Edge(Blocked, b4) };
        var statuses = Statuses(
            Snap(Blocked, "B", TaskItemStatus.Ready),
            Snap(b1, "One", TaskItemStatus.Planning),
            Snap(b2, "Two", TaskItemStatus.Planning),
            Snap(b3, "Three", TaskItemStatus.Planning),
            Snap(b4, "Four", TaskItemStatus.Planning));
        var ev = BlockedTaskMoves.Evaluate(edges, statuses);

        var ex = Assert.Throws<ConflictException>(() =>
            BlockedTaskMoves.ThrowIfBlocked(ev, Blocked, "B", id => names.GetValueOrDefault(id)));

        Assert.Contains("\"One\"", ex.Message);
        Assert.Contains("\"Two\"", ex.Message);
        Assert.Contains("\"Three\"", ex.Message);
        Assert.DoesNotContain("\"Four\"", ex.Message);
        Assert.Contains("(+1 more)", ex.Message);
        Assert.Contains("resolve those blockers before moving it", ex.Message);
    }

    [Fact]
    public void ThrowIfBlocked_UnknownBlockerTitles_FallsBackToCount()
    {
        var ev = BlockedTaskMoves.Evaluate(
            new List<TaskDependency> { Edge(Blocked, Blocker) },
            Statuses(Snap(Blocked, "B", TaskItemStatus.Ready), Snap(Blocker, "X", TaskItemStatus.Planning)));

        var ex = Assert.Throws<ConflictException>(() =>
            BlockedTaskMoves.ThrowIfBlocked(ev, Blocked, "B", _ => null));

        Assert.Contains("blocked by 1 unresolved blocker(s)", ex.Message);
    }
}
