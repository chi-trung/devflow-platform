using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.RemoveMembers;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record RemoveMemberCommand(Guid WorkspaceId, Guid UserId) : IRequest, IWorkspaceRequest, INotificationEvent
{
    public string NotificationType => "RemovedFromWorkspace";
    public Guid? RecipientUserId => UserId;
    public Guid? TaskItemId => null;
    public Guid? ProjectId => null;
    public string FormatMessage(string actorName) => $"{actorName} removed you from the workspace";

    Guid? INotificationEvent.WorkspaceId => WorkspaceId;
}