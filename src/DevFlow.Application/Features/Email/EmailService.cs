namespace DevFlow.Application.Features.Email;

public interface IEmailService
{
    Task SendTaskAssignedEmailAsync(string toEmail, string taskTitle, string projectName, string assignedBy);
    Task SendMentionEmailAsync(string toEmail, string taskTitle, string comment, string mentionedBy);
    Task SendSprintStartedEmailAsync(string toEmail, string sprintName, string projectName);
}

public class NoOpEmailService : IEmailService
{
    public Task SendTaskAssignedEmailAsync(string toEmail, string taskTitle, string projectName, string assignedBy)
    {
        // TODO: Integrate with SendGrid/Resend
        return Task.CompletedTask;
    }

    public Task SendMentionEmailAsync(string toEmail, string taskTitle, string comment, string mentionedBy)
    {
        return Task.CompletedTask;
    }

    public Task SendSprintStartedEmailAsync(string toEmail, string sprintName, string projectName)
    {
        return Task.CompletedTask;
    }
}
