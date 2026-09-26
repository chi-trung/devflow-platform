using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DetachSubtaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid ParentTaskId,
    Guid SubtaskId) : IRequest, IWorkspaceRequest, IProjectEvent, IActivityLabelSink
{
    public string ActivityVerb => "detached subtask";

    /// <summary>Placeholder only — the id means nothing to a reader. The handler
    /// replaces it with the subtask title via <see cref="IActivityLabelSink"/>.</summary>
    public string ActivityLabel => "";

    public Guid? ActivityTaskId => ParentTaskId;
    public string? ResolvedActivityLabel { get; set; }
}
