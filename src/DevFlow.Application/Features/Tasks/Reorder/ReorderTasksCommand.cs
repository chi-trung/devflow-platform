using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

// Cache-invalidation carrier: reorder writes Position and Status, which the
// board's cached tasks payload embeds. Without IProjectEvent,
// CacheInvalidationBehavior skips it and the 30s tasks:{projectId}:* cache —
// plus dashboard counts — keeps serving pre-reorder rows, so the GET after a
// drag reverts the board. ActivityVerb stays empty → no activity-log entry.
public sealed record ReorderTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    IReadOnlyList<ReorderTaskItem> Tasks) : IRequest, IProjectEvent;

public sealed class ReorderTaskItem
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Position { get; set; }
}
