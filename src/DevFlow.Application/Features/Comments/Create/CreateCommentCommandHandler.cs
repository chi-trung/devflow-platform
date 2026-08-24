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

        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Parse @mentions and create notifications
        var mentionedUsernames = ExtractMentions(command.Content);
        var mentionedUserIds = new HashSet<Guid>();

        foreach (var username in mentionedUsernames)
        {
            var mentionedUser = await userRepository.GetByUsernameAsync(username, cancellationToken);
            if (mentionedUser is null || mentionedUser.Id == userContext.UserId)
                continue;

            mentionedUserIds.Add(mentionedUser.Id);

            // Create notification
            var notification = Notification.Create(
                mentionedUser.Id,
                "Mention",
                $"mentioned you in a comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                userContext.UserId);

            await notificationRepository.AddAsync(notification, cancellationToken);

            // Push realtime notification to the mentioned user's group
            await realtimeNotificationService.NotifyUserAsync(
                mentionedUser.Id,
                "Mention",
                $"mentioned you in a comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                cancellationToken);

            // Send email notification only if the user has mentions enabled
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

        // Notify watchers (excluding the actor and anyone already mentioned above)
        var watchers = await watcherRepository.GetByTaskAsync(task.Id, cancellationToken);

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

            await realtimeNotificationService.NotifyUserAsync(
                watcher.UserId,
                "TaskUpdate",
                $"new comment on \"{task.Title}\"",
                task.Id,
                project.Id,
                project.WorkspaceId,
                cancellationToken);
        }

        if (mentionedUsernames.Count > 0 || watchers.Count > 0)
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }

        return new CommentResponse(comment.Id, comment.TaskItemId, comment.AuthorId, comment.Content, comment.CreatedAtUtc);
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
