using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Comments.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateCommentCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string Content,
    Guid? AssigneeId = null) : IRequest<CommentResponse>, IWorkspaceRequest, IProjectEvent, INotificationEvent
{
        public string ActivityVerb => "commented on task";
        public string ActivityLabel => Content.Length <= 40 ? Content : Content[..40] + "\u2026";
        public Guid? ActivityTaskId => TaskId;

        // Notification event - explicitly implement nullable Guid? properties
        Guid? INotificationEvent.ProjectId => ProjectId;
        Guid? INotificationEvent.WorkspaceId => WorkspaceId;
        public string NotificationType => "CommentAdded";
        public Guid? RecipientUserId => AssigneeId;
        public Guid? TaskItemId => TaskId;

        public string FormatMessage(string actorName) => $"{actorName} commented on \"{ActivityLabel}\"";
    }
