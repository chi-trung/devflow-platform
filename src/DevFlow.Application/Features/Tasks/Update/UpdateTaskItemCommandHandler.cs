using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Tasks.Update;

public sealed class UpdateTaskItemCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IWorkspaceRepository workspaceRepository,
    IUserRepository userRepository,
    INotificationRepository notificationRepository,
    INotificationPreferencesRepository preferencesRepository,
    ITaskWatcherRepository watcherRepository,
    IEmailService emailService,
    IRealtimeNotificationService realtimeNotificationService,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateTaskItemCommand>
{
    public async Task Handle(UpdateTaskItemCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        if (command.AssigneeId is not null)
        {
            var assigneeRole = await workspaceRepository.GetMemberRoleAsync(
                command.WorkspaceId, command.AssigneeId.Value, cancellationToken);

            if (assigneeRole is null)
            {
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["AssigneeId"] = ["Assignee must be a member of the workspace."],
                });
            }
        }

        var oldAssigneeId = task.AssigneeId;
        var oldStatus = task.Status;

        task.UpdateDetails(command.Title, command.Description, command.Priority, command.DueDateUtc);
        task.ChangeStatus(command.Status);
        task.AssignTo(command.AssigneeId);

        // Cascading state rule: when the last open subtask is completed, complete its parent.
        if (task.Status == TaskItemStatus.Done && task.ParentTaskId is not null)
        {
            await CompleteParentIfAllSubtasksDoneAsync(task, cancellationToken);
        }

        // Log meaningful changes so the activity feed reflects what actually happened.
        if (task.Status != oldStatus)
        {
            var statusLog = ActivityLog.Create(
                command.WorkspaceId,
                command.ProjectId,
                task.Id,
                userContext.UserId,
                "moved task to",
                task.Status.ToString());
            await activityLog.AddAsync(statusLog, cancellationToken);
        }

        if (command.AssigneeId != oldAssigneeId)
        {
            var assigneeName = command.AssigneeId is null
                ? "unassigned"
                : (await userRepository.GetByIdAsync(command.AssigneeId.Value, cancellationToken))?.DisplayName ?? "a user";
            var assignLog = ActivityLog.Create(
                command.WorkspaceId,
                command.ProjectId,
                task.Id,
                userContext.UserId,
                "assigned task to",
                assigneeName);
            await activityLog.AddAsync(assignLog, cancellationToken);
        }

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Notify the new assignee when a task is assigned
        if (command.AssigneeId is not null && command.AssigneeId != oldAssigneeId)
        {
            var assignee = await userRepository.GetByIdAsync(command.AssigneeId.Value, cancellationToken);
            if (assignee is not null)
            {
                var notification = Notification.Create(
                    assignee.Id,
                    "Assignment",
                    $"assigned you to \"{command.Title}\"",
                    task.Id,
                    project.Id,
                    project.WorkspaceId,
                    userContext.UserId);

                await notificationRepository.AddAsync(notification, cancellationToken);
                await unitOfWork.SaveChangesAsync(cancellationToken);

                await realtimeNotificationService.NotifyUserAsync(
                    assignee.Id,
                    "Assignment",
                    $"assigned you to \"{command.Title}\"",
                    task.Id,
                    project.Id,
                    project.WorkspaceId,
                    cancellationToken);

                var prefs = await preferencesRepository.GetByUserIdAsync(assignee.Id, cancellationToken);
                if (prefs?.EmailOnAssignment != false && !string.IsNullOrWhiteSpace(assignee.Email))
                {
                    _ = emailService.SendTaskAssignedEmailAsync(
                            assignee.Email,
                            command.Title,
                            project.Name,
                            "A team member",
                            project.WorkspaceId.ToString(),
                            project.Id.ToString(),
                            task.Id.ToString())
                        .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
                }
            }
        }

        // Notify watchers when the task changes (status or assignment)
        if (task.Status != oldStatus || command.AssigneeId != oldAssigneeId)
        {
            var watchers = await watcherRepository.GetByTaskAsync(task.Id, cancellationToken);
            var notifiedIds = new HashSet<Guid>();
            if (command.AssigneeId is not null) notifiedIds.Add(command.AssigneeId.Value);

            foreach (var watcher in watchers.Where(w => w.UserId != userContext.UserId && !notifiedIds.Contains(w.UserId)))
            {
                var message = task.Status != oldStatus
                    ? $"status changed to {task.Status} on \"{task.Title}\""
                    : $"\"{task.Title}\" was updated";

                var notification = Notification.Create(
                    watcher.UserId,
                    "TaskUpdate",
                    message,
                    task.Id,
                    project.Id,
                    project.WorkspaceId);

                await notificationRepository.AddAsync(notification, cancellationToken);

                await realtimeNotificationService.NotifyUserAsync(
                    watcher.UserId,
                    "TaskUpdate",
                    message,
                    task.Id,
                    project.Id,
                    project.WorkspaceId,
                    cancellationToken);
            }

            if (watchers.Count > 0)
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
            }
        }
    }

    private async Task CompleteParentIfAllSubtasksDoneAsync(TaskItem subtask, CancellationToken cancellationToken)
    {
        var parent = await taskItemRepository.GetByIdAsync(subtask.ParentTaskId!.Value, cancellationToken);

        if (parent is null || parent.Status == TaskItemStatus.Done)
        {
            return;
        }

        var siblings = await taskItemRepository.GetSubtasksAsync(parent.Id, cancellationToken);

        if (siblings.All(sibling => sibling.Status == TaskItemStatus.Done))
        {
            parent.ChangeStatus(TaskItemStatus.Done);
        }
    }
}
