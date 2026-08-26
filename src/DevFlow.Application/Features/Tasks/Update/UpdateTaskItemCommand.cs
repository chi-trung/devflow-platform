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
        public string ActivityVerb => "updated task";
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
