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
    Guid SubtaskId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "detached subtask";
    public string ActivityLabel => SubtaskId.ToString();
    public Guid? ActivityTaskId => ParentTaskId;
}
