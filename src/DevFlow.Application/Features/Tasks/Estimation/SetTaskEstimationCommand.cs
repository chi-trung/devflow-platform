using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Estimation;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record SetTaskEstimationCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    int? StoryPoints) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "estimated task";
    public string ActivityLabel => StoryPoints is null ? "cleared estimate" : $"{StoryPoints} points";
    public Guid? ActivityTaskId => TaskId;
}
