using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateTaskItemCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid TaskId,
    string Title,
    string? Description,
    TaskItemStatus Status,
    TaskItemPriority Priority,
    Guid? AssigneeId,
    DateTimeOffset? DueDateUtc,
    string? DefinitionOfDone = null) : IRequest, IWorkspaceRequest, IProjectEvent, INotificationEvent
{
        // Empty on purpose. This command writes its own, better logs inside the
        // handler — "moved task to Done", "assigned task to X" — each of which
        // carries something "updated task" does not. Leaving the automatic verb
        // here would add a third, content-free row to every save, and the
        // dashboard feed has room for only five.
        public string ActivityVerb => "";
        public string ActivityLabel => Title ?? "a task";
        public Guid? ActivityTaskId => TaskId;

        // Notification event - explicitly implement nullable Guid? properties
        Guid? INotificationEvent.ProjectId => ProjectId;
        Guid? INotificationEvent.WorkspaceId => WorkspaceId;
        public string NotificationType => Status == TaskItemStatus.Done ? "StatusChanged" : "TaskAssigned";
        public Guid? RecipientUserId => AssigneeId;
        public Guid? TaskItemId => TaskId;

        public string FormatMessage(string actorName) => Status == TaskItemStatus.Done
            ? $"{actorName} completed \"{Title}\""
            : $"{actorName} assigned you to \"{Title}\"";
    }
