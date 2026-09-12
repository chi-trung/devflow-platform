using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.AttachToEpic;

/// <summary>
/// Attaches a task to an epic. Lives as a command (not a direct repository
/// mutation in the AI executor) because EpicId ships on every cached board
/// card: only IProjectEvent triggers cache invalidation and the realtime
/// board-wake.
/// </summary>
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AttachTaskToEpicCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid EpicId,
    Guid TaskId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "added task to epic";
    public string ActivityLabel => "a task";
    public Guid? ActivityTaskId => TaskId;
}
