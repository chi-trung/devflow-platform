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
}
