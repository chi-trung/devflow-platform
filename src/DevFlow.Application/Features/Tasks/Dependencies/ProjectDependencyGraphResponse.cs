using System.Text.Json.Serialization;

namespace DevFlow.Application.Features.Tasks.Dependencies;

/// <summary>
/// Trailing default keeps old serialized cache entries deserializable across
/// a deploy; fresh graph responses always compute it via BlockedTaskMoves.
/// </summary>
public sealed record TaskGraphNode(
    Guid Id,
    string Title,
    string Status,
    Guid? AssigneeId,
    Guid ProjectId,
    bool IsBlocked = false);

public sealed record DependencyGraphEdge(
    Guid FromTaskId,
    Guid ToTaskId,
    bool IsCyclic);

public sealed record ProjectDependencyGraphResponse(
    IReadOnlyList<TaskGraphNode> Nodes,
    IReadOnlyList<DependencyGraphEdge> Edges,
    IReadOnlyList<Guid> CyclicNodeIds);
