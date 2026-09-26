using DevFlow.Application.Features.Email;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Active when no transport is configured — local development, or a deployment
/// that has not set up Resend or SMTP yet.
///
/// It is NOT a silent no-op. Registration now depends on a verification link
/// actually reaching the new user, and a lost account is now recoverable
/// through a reset link — so dropping either on the floor would strand people.
/// Both links are written to the log instead, which is what makes the whole
/// flow testable without a mail provider.
///
/// The other eight emails stay quiet: they are notifications, the account
/// already exists, and nobody is blocked by their absence.
/// </summary>
public sealed class ConsoleLogEmailService(ILogger<ConsoleLogEmailService> logger) : IEmailService
{
    public Task SendEmailVerificationAsync(
        string toEmail, string displayName, string verificationUrl)
    {
        logger.LogWarning(
            "EMAIL VERIFICATION (no mail provider configured — link below was NOT sent).\n" +
            "  To:      {ToEmail}\n" +
            "  Name:    {DisplayName}\n" +
            "  Link:    {VerificationUrl}\n" +
            "  Expires: in 24 hours",
            toEmail,
            displayName,
            verificationUrl);

        return Task.CompletedTask;
    }

    public Task SendPasswordResetAsync(
        string toEmail, string displayName, string resetUrl)
    {
        logger.LogWarning(
            "PASSWORD RESET (no mail provider configured — link below was NOT sent).\n" +
            "  To:      {ToEmail}\n" +
            "  Name:    {DisplayName}\n" +
            "  Link:    {ResetUrl}\n" +
            "  Expires: in 30 minutes, single use",
            toEmail,
            displayName,
            resetUrl);

        return Task.CompletedTask;
    }

    public Task SendTaskAssignedEmailAsync(
        string toEmail, string taskTitle, string projectName, string assignedBy,
        string workspaceId, string projectId, string taskId)
        => Task.CompletedTask;

    public Task SendMentionEmailAsync(
        string toEmail, string taskTitle, string comment, string mentionedBy,
        string workspaceId, string projectId, string taskId)
        => Task.CompletedTask;

    public Task SendSprintStartedEmailAsync(
        string toEmail, string sprintName, string projectName,
        string workspaceId, string projectId, string sprintId)
        => Task.CompletedTask;

    public Task SendTaskStatusChangedEmailAsync(
        string toEmail, string taskTitle, string projectName, string newStatus, string changedBy,
        string workspaceId, string projectId, string taskId)
        => Task.CompletedTask;

    public Task SendCommentAddedEmailAsync(
        string toEmail, string taskTitle, string projectName, string comment, string commenterName,
        string workspaceId, string projectId, string taskId)
        => Task.CompletedTask;

    public Task SendRoleChangedEmailAsync(
        string toEmail, string workspaceName, string newRole, string changedBy, string workspaceId)
        => Task.CompletedTask;

    public Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail, string workspaceName, string removedBy, string workspaceId)
        => Task.CompletedTask;

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail, string workspaceName, string invitedBy, string role, string workspaceId)
        => Task.CompletedTask;
}
