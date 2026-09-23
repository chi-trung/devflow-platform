using System.Text.RegularExpressions;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.Email;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Comments.Create;

public sealed partial class CreateCommentCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    ICommentRepository commentRepository,
    IUserRepository userRepository,
    INotificationRepository notificationRepository,
    INotificationPreferencesRepository preferencesRepository,
    ITaskWatcherRepository watcherRepository,
    IEmailService emailService,
    IRealtimeNotificationService realtimeNotificationService,
    IActivityLogRepository activityLog,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateCommentCommand, CommentResponse>
{
    public async Task<CommentResponse> Handle(
        CreateCommentCommand command,
        CancellationToken cancellationToken)
    {
        // Independent reads — one RTT instead of two sequential hops to Postgres.
        var projectTask = projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);
        var taskLoadTask = taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);
        await Task.WhenAll(projectTask, taskLoadTask);
        var project = projectTask.Result;
        var task = taskLoadTask.Result;

        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        var comment = Comment.Create(command.TaskId, userContext.UserId, command.Content);

        await commentRepository.AddAsync(comment, cancellationToken);

        var log = ActivityLog.Create(
            command.WorkspaceId,
            command.ProjectId,
            task.Id,
            userContext.UserId,
            "commented on task",
            task.Title);
        await activityLog.AddAsync(log, cancellationToken);

        // Comment + activity must be durable before any notify fan-out.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        var mentionedUsernames = ExtractMentions(command.Content);
        var mentionedUserIds = new HashSet<Guid>();

        // Resolve @handles and load the watcher list together — neither depends
        // on the other, and both are pure reads after the comment is committed.
        var mentionLookupTask = mentionedUsernames.Count == 0
            ? Task.FromResult(Array.Empty<Domain.Entities.User?>())
            : Task.WhenAll(mentionedUsernames.Select(username =>
                userRepository.GetByUsernameAsync(username, cancellationToken)));
        var watchersTask = watcherRepository.GetByTaskAsync(task.Id, cancellationToken);
        await Task.WhenAll(mentionLookupTask, watchersTask);

        var mentionedUsers = await mentionLookupTask;
        var watchers = await watchersTask;

        // SignalR is best-effort fan-out; awaiting each send before the HTTP
        // response made every comment wait on hub RTT for every mention/watcher.
        var realtimeTasks = new List<Task>();

        for (var i = 0; i < mentionedUsernames.Count; i++)
        {
            var mentionedUser = mentionedUsers[i];
            if (mentionedUser is null || mentionedUser.Id == userContext.UserId)
                continue;

            mentionedUserIds.Add(mentionedUser.Id);

            var notification = Notification.Create(
                mentionedUser.Id,
                "Mention",
                $"mentioned you in a comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                userContext.UserId);

            await notificationRepository.AddAsync(notification, cancellationToken);

            realtimeTasks.Add(realtimeNotificationService.NotifyUserAsync(
                mentionedUser.Id,
                "Mention",
                $"mentioned you in a comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                CancellationToken.None));

            var prefs = await preferencesRepository.GetByUserIdAsync(mentionedUser.Id, cancellationToken);
            if (prefs?.EmailOnMention != false && !string.IsNullOrWhiteSpace(mentionedUser.Email))
            {
                var author = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
                var authorName = author?.DisplayName ?? author?.Username ?? "Someone";
                _ = emailService.SendMentionEmailAsync(
                        mentionedUser.Email,
                        task.Title,
                        command.Content,
                        authorName,
                        project.WorkspaceId.ToString(),
                        project.Id.ToString(),
                        task.Id.ToString())
                    .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
            }
        }

        foreach (var watcher in watchers.Where(w => w.UserId != userContext.UserId && !mentionedUserIds.Contains(w.UserId)))
        {
            var notification = Notification.Create(
                watcher.UserId,
                "TaskUpdate",
                $"new comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId);

            await notificationRepository.AddAsync(notification, cancellationToken);

            realtimeTasks.Add(realtimeNotificationService.NotifyUserAsync(
                watcher.UserId,
                "TaskUpdate",
                $"new comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                CancellationToken.None));
        }

        // Email the task assignee when a new comment is added (CommentAdded event)
        if (command.AssigneeId is not null && command.AssigneeId != userContext.UserId && !mentionedUserIds.Contains(command.AssigneeId.Value))
        {
            var assignee = await userRepository.GetByIdAsync(command.AssigneeId.Value, cancellationToken);
            if (assignee is not null)
            {
                var prefs = await preferencesRepository.GetByUserIdAsync(assignee.Id, cancellationToken);
                if (prefs?.EmailOnCommentAdded != false && !string.IsNullOrWhiteSpace(assignee.Email))
                {
                    var author = await userRepository.GetByIdAsync(userContext.UserId, cancellationToken);
                    var authorName = author?.DisplayName ?? author?.Username ?? "Someone";
                    _ = emailService.SendCommentAddedEmailAsync(
                            assignee.Email,
                            task.Title,
                            project.Name,
                            command.Content,
                            authorName,
                            project.WorkspaceId.ToString(),
                            project.Id.ToString(),
                            task.Id.ToString())
                        .ContinueWith(_ => Task.CompletedTask, TaskContinuationOptions.OnlyOnCanceled);
                }
            }
        }

        if (mentionedUsernames.Count > 0 || watchers.Count > 0)
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        // Hub sends may still be in flight; do not hold the 201 on them.
        // Failures are observed so they never surface as unobserved-task noise.
        ObserveRealtime(realtimeTasks);

        return new CommentResponse(comment.Id, comment.TaskItemId, comment.AuthorId, comment.Content, comment.CreatedAtUtc);
    }

    private static void ObserveRealtime(List<Task> tasks)
    {
        foreach (var task in tasks)
        {
            _ = task.ContinueWith(
                static t => _ = t.Exception,
                CancellationToken.None,
                TaskContinuationOptions.OnlyOnFaulted | TaskContinuationOptions.ExecuteSynchronously,
                TaskScheduler.Default);
        }
    }

    /// <summary>
    /// Extract @username mentions from comment content.
    /// Matches @word patterns (letters, digits, underscores only).
    /// </summary>
    private static List<string> ExtractMentions(string content)
    {
        if (string.IsNullOrWhiteSpace(content))
            return [];

        var matches = MentionRegex().Matches(content);
        var usernames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (Match match in matches)
        {
            usernames.Add(match.Groups[1].Value);
        }

        return usernames.ToList();
    }

    [GeneratedRegex(@"(?<![a-zA-Z0-9_])@([a-zA-Z0-9_]+)")]
    private static partial Regex MentionRegex();
}
