using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Subtasks;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateSubtaskCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid ParentTaskId,
    string Title,
    string? Description,
    TaskItemPriority Priority) : IRequest<SubtaskCreatedResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "created subtask";
    public string ActivityLabel => Title;
    public Guid? ActivityTaskId => ParentTaskId;
}

public sealed record SubtaskCreatedResponse(Guid Id, Guid ParentTaskId);
