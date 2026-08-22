using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Reorder;

public sealed record ReorderTasksCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    IReadOnlyList<ReorderTaskItem> Tasks) : IRequest;

public sealed record ReorderTaskItem(Guid Id, string Status, int Position);
