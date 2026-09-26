namespace DevFlow.Application.Features.Email;

public interface IEmailService
{
    /// <summary>
    /// Delivers the one-click link that proves the recipient controls
    /// <paramref name="toEmail"/>. Unlike the notifications below, a failure
    /// here blocks the sign-up itself, so the link is also logged locally
    /// rather than silently dropped.
    /// </summary>
    Task SendEmailVerificationAsync(
        string toEmail,
        string displayName,
        string verificationUrl);

    /// <summary>
    /// Delivers the one-shot link that lets the recipient choose a new
    /// password. Like the verification link this is on the critical path of
    /// getting into the account, so a local run logs it rather than dropping
    /// it. If the mail never arrives, the address is unreachable and the
    /// account is not.
    /// </summary>
    Task SendPasswordResetAsync(
        string toEmail,
        string displayName,
        string resetUrl);

    Task SendTaskAssignedEmailAsync(
        string toEmail,
        string taskTitle,
        string projectName,
        string assignedBy,
        string workspaceId,
        string projectId,
        string taskId);

    Task SendMentionEmailAsync(
        string toEmail,
        string taskTitle,
        string comment,
        string mentionedBy,
        string workspaceId,
        string projectId,
        string taskId);

    Task SendSprintStartedEmailAsync(
        string toEmail,
        string sprintName,
        string projectName,
        string workspaceId,
        string projectId,
        string sprintId);

    Task SendTaskStatusChangedEmailAsync(
        string toEmail,
        string taskTitle,
        string projectName,
        string newStatus,
        string changedBy,
        string workspaceId,
        string projectId,
        string taskId);

    Task SendCommentAddedEmailAsync(
        string toEmail,
        string taskTitle,
        string projectName,
        string comment,
        string commenterName,
        string workspaceId,
        string projectId,
        string taskId);

    Task SendRoleChangedEmailAsync(
        string toEmail,
        string workspaceName,
        string newRole,
        string changedBy,
        string workspaceId);

    Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail,
        string workspaceName,
        string removedBy,
        string workspaceId);

    Task SendWorkspaceInviteEmailAsync(
        string toEmail,
        string workspaceName,
        string invitedBy,
        string role,
        string workspaceId);
}

public class NoOpEmailService : IEmailService
{
    public Task SendEmailVerificationAsync(
        string toEmail, string displayName, string verificationUrl)
    {
        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(
        string toEmail, string displayName, string resetUrl)
    {
        return Task.CompletedTask;
    }

    public Task SendTaskAssignedEmailAsync(
        string toEmail, string taskTitle, string projectName, string assignedBy,
        string workspaceId, string projectId, string taskId)
    {
        return Task.CompletedTask;
    }

    public Task SendMentionEmailAsync(
        string toEmail, string taskTitle, string comment, string mentionedBy,
        string workspaceId, string projectId, string taskId)
    {
        return Task.CompletedTask;
    }

    public Task SendSprintStartedEmailAsync(
        string toEmail, string sprintName, string projectName,
        string workspaceId, string projectId, string sprintId)
    {
        return Task.CompletedTask;
    }

    public Task SendTaskStatusChangedEmailAsync(
        string toEmail, string taskTitle, string projectName, string newStatus, string changedBy,
        string workspaceId, string projectId, string taskId)
    {
        return Task.CompletedTask;
    }

    public Task SendCommentAddedEmailAsync(
        string toEmail, string taskTitle, string projectName, string comment, string commenterName,
        string workspaceId, string projectId, string taskId)
    {
        return Task.CompletedTask;
    }

    public Task SendRoleChangedEmailAsync(
        string toEmail, string workspaceName, string newRole, string changedBy, string workspaceId)
    {
        return Task.CompletedTask;
    }

    public Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail, string workspaceName, string removedBy, string workspaceId)
    {
        return Task.CompletedTask;
    }

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail, string workspaceName, string invitedBy, string role, string workspaceId)
    {
        return Task.CompletedTask;
    }
}
