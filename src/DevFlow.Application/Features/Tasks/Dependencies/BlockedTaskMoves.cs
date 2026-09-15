using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Features.Tasks.Dependencies;

/// <summary>
/// Identity + status of a task as needed by the blocked-move guard, projected
/// in one query per project. Kept small on purpose: the guard never needs the
/// full entity, and loading full entities would track them in the change
/// tracker on a read path.
/// </summary>
public sealed record TaskStatusSnapshot(Guid Id, string Title, TaskItemStatus Status);

/// <summary>
/// Single source of truth for "blocked": a task is blocked while it has at
/// least one dependency edge whose blocker task exists and is not Done.
/// Cyclic pairs are exempt — a cycle can never be resolved by moving its
/// members through Done, so enforcing it would lock every task in the cycle
/// out of status changes forever; the project graph labels those edges
/// IsCyclic and the guard skips exactly what the graph labels. A blocker that
/// no longer resolves (soft-deleted, or outside the project) is also exempt:
/// there is nothing left to resolve. Both the write-path guards and the graph
/// endpoint call <see cref="Evaluate"/> so enforcement can never drift from
/// what the board displays.
/// </summary>
public static class BlockedTaskMoves
{
    public sealed record Evaluation(
        IReadOnlyDictionary<Guid, IReadOnlyList<Guid>> UnresolvedBlockersByTaskId,
        HashSet<Guid> CyclicNodeIds)
    {
        /// <summary>Blocker title for a message, or null when the task is not
        /// in the snapshot (deleted / far-project endpoint).</summary>
        public Func<Guid, string?> BlockerTitleOf { get; init; } = _ => null;

        public void ThrowIfBlocked(Guid taskId, string taskTitle)
            => BlockedTaskMoves.ThrowIfBlocked(this, taskId, taskTitle, BlockerTitleOf);
    }

    /// <summary>
    /// Loads the project's edge set and endpoint statuses and evaluates them.
    /// Two queries regardless of how many tasks the caller goes on to check,
    /// which is why batch callers (reorder, bulk) evaluate once up front.
    /// </summary>
    public static async Task<Evaluation> EvaluateAsync(
        ITaskDependencyRepository dependencyRepository,
        Guid projectId,
        CancellationToken cancellationToken = default)
    {
        var dependencies = await dependencyRepository.GetAllByProjectIdAsync(projectId, cancellationToken);
        var snapshots = await dependencyRepository.GetDependencyTaskSnapshotsAsync(projectId, cancellationToken);
        var byId = snapshots.ToDictionary(s => s.Id);
        var evaluation = Evaluate(dependencies, id => byId.TryGetValue(id, out var s) ? s.Status : null);
        return evaluation with { BlockerTitleOf = id => byId.TryGetValue(id, out var s) ? s.Title : null };
    }

    public static Evaluation Evaluate(
        IReadOnlyList<TaskDependency> dependencies,
        Func<Guid, TaskItemStatus?> statusOf)
    {
        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in dependencies)
        {
            if (!adjacency.ContainsKey(dep.BlockedTaskId))
                adjacency[dep.BlockedTaskId] = new List<Guid>();
            adjacency[dep.BlockedTaskId].Add(dep.BlockerTaskId);
        }

        var visited = new HashSet<Guid>();
        var recursionStack = new HashSet<Guid>();
        var cyclicNodeIds = new HashSet<Guid>();
        var path = new List<Guid>();

        void Dfs(Guid node)
        {
            visited.Add(node);
            recursionStack.Add(node);
            path.Add(node);

            if (adjacency.TryGetValue(node, out var neighbors))
            {
                foreach (var neighbor in neighbors)
                {
                    if (!visited.Contains(neighbor))
                    {
                        Dfs(neighbor);
                    }
                    else if (recursionStack.Contains(neighbor))
                    {
                        var cycleStartIdx = path.IndexOf(neighbor);
                        for (var i = cycleStartIdx; i < path.Count; i++)
                        {
                            cyclicNodeIds.Add(path[i]);
                        }
                        cyclicNodeIds.Add(neighbor);
                    }
                }
            }

            path.Remove(node);
            recursionStack.Remove(node);
        }

        foreach (var nodeId in adjacency.Keys)
        {
            if (!visited.Contains(nodeId))
                Dfs(nodeId);
        }

        var unresolved = new Dictionary<Guid, List<Guid>>();
        foreach (var dep in dependencies)
        {
            var blockerStatus = statusOf(dep.BlockerTaskId);
            if (blockerStatus is null || blockerStatus == TaskItemStatus.Done)
                continue;

            if (cyclicNodeIds.Contains(dep.BlockedTaskId) && cyclicNodeIds.Contains(dep.BlockerTaskId))
                continue;

            if (!unresolved.TryGetValue(dep.BlockedTaskId, out var blockerIds))
                unresolved[dep.BlockedTaskId] = blockerIds = new List<Guid>();
            if (!blockerIds.Contains(dep.BlockerTaskId))
                blockerIds.Add(dep.BlockerTaskId);
        }

        return new Evaluation(
            unresolved.ToDictionary(kv => kv.Key, kv => (IReadOnlyList<Guid>)kv.Value),
            cyclicNodeIds);
    }

    /// <summary>
    /// Rejects a status change on a task that still has unresolved blockers.
    /// Callers evaluate the project once and reuse the result across a batch.
    /// Titles come from the same snapshot that produced the evaluation, so
    /// naming blockers costs no extra queries. The 409 detail surfaces
    /// verbatim in the client (problem+json detail → ApiError.message).
    /// </summary>
    public static void ThrowIfBlocked(
        Evaluation evaluation,
        Guid taskId,
        string taskTitle,
        Func<Guid, string?> blockerTitleOf)
    {
        if (!evaluation.UnresolvedBlockersByTaskId.TryGetValue(taskId, out var blockerIds) || blockerIds.Count == 0)
        {
            return;
        }

        const int maxNamed = 3;
        var names = blockerIds.Take(maxNamed)
            .Select(id => blockerTitleOf(id))
            .Where(n => n is not null)
            .Select(n => $"\"{n}\"")
            .ToList();
        var named = names.Count > 0
            ? $" blocked by {string.Join(", ", names)}{(blockerIds.Count > maxNamed ? $" (+{blockerIds.Count - maxNamed} more)" : "")}"
            : $" blocked by {blockerIds.Count} unresolved blocker(s)";
        throw new ConflictException($"Task \"{taskTitle}\" is{named} — resolve those blockers before moving it.");
    }
}
