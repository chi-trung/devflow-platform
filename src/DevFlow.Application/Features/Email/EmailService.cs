namespace DevFlow.Application.Features.Email;

public interface IEmailService
{
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
}

public class NoOpEmailService : IEmailService
{
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
}
