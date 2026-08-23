using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Workspaces.UpdateMemberRole;

[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UpdateMemberRoleCommand(Guid WorkspaceId, Guid UserId, WorkspaceRole Role) : IRequest, IWorkspaceRequest, INotificationEvent
{
    public string NotificationType => "RoleChanged";
    public Guid? RecipientUserId => UserId;
    public Guid? TaskItemId => null;
    public Guid? ProjectId => null;
    public string FormatMessage(string actorName) => $"{actorName} changed your role to {Role}";

    Guid? INotificationEvent.WorkspaceId => WorkspaceId;
}