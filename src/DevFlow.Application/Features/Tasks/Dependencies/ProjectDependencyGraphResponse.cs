using System.Text.Json.Serialization;

namespace DevFlow.Application.Features.Tasks.Dependencies;

public sealed record TaskGraphNode(
    Guid Id,
    string Title,
    string Status,
    Guid? AssigneeId,
    Guid ProjectId);

public sealed record DependencyGraphEdge(
    Guid FromTaskId,
    Guid ToTaskId,
    bool IsCyclic);

public sealed record ProjectDependencyGraphResponse(
    IReadOnlyList<TaskGraphNode> Nodes,
    IReadOnlyList<DependencyGraphEdge> Edges,
    IReadOnlyList<Guid> CyclicNodeIds);
