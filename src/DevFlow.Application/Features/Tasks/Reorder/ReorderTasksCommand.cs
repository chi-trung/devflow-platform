using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

public sealed record ReorderTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    IReadOnlyList<ReorderTaskItem> Tasks) : IRequest;

public sealed class ReorderTaskItem
{
    public Guid Id { get; set; }
    public string Status { get; set; } = string.Empty;
    public int Position { get; set; }
}
