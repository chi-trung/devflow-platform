using DevFlow.Application.Features.Email;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using MimeKit;
using MimeKit.Text;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Delivers DevFlow's mail over plain SMTP, for anyone who has an SMTP mailbox
/// but no sending domain.
///
/// The case that matters is free: Gmail app passwords. A Google account with
/// 2-Step Verification can mint a 16-character app password, which speaks
/// SMTP on <c>smtp.gmail.com:587</c> with no DNS to set up and no paid plan to
/// buy — the one route to working mail when you own no domain, which is also
/// the condition the HTTP providers refuse to help with.
///
/// Two costs of that route are worth stating plainly, because they are why
/// this is not a permanent answer:
///
/// <list type="bullet">
/// <item>Messages go out from a person's mailbox, not a branded one. Gmail and
/// most receiving providers judge SMTP traffic from a plain consumer account
/// more harshly than traffic from a domain with SPF/DKIM set, so a verification
/// mail is somewhat more likely to land in spam. Fine for a handful of
/// signups a day; not something to build a launch on.</item>
/// <item>The account is a single point of failure. Changing that Google
/// password revokes the app password immediately, and a mailbox locked by
/// Google's abuse filters takes every verification and reset mail with it.</item>
/// </list>
///
/// So the DI chain keeps a real provider ahead of this one. Reach for SMTP when
/// a domain is not yet worth buying, then move to it once it is.
/// </summary>
public sealed class SmtpEmailService(
    SmtpOptions options,
    EmailComposer composer,
    ILogger<SmtpEmailService> logger) : IEmailService
{
    public Task SendEmailVerificationAsync(
        string toEmail, string displayName, string verificationUrl)
        => SendAsync(toEmail, composer.EmailVerification(displayName, verificationUrl));

    public Task SendPasswordResetAsync(
        string toEmail, string displayName, string resetUrl)
        => SendAsync(toEmail, composer.PasswordReset(displayName, resetUrl));

    public Task SendTaskAssignedEmailAsync(
        string toEmail, string taskTitle, string projectName, string assignedBy,
        string workspaceId, string projectId, string taskId)
        => SendAsync(toEmail, composer.TaskAssigned(
            taskTitle, projectName, assignedBy, TaskUrl(workspaceId, projectId, taskId)));

    public Task SendMentionEmailAsync(
        string toEmail, string taskTitle, string comment, string mentionedBy,
        string workspaceId, string projectId, string taskId)
        => SendAsync(toEmail, composer.Mention(
            taskTitle, comment, mentionedBy, TaskUrl(workspaceId, projectId, taskId)));

    public Task SendSprintStartedEmailAsync(
        string toEmail, string sprintName, string projectName,
        string workspaceId, string projectId, string sprintId)
        => SendAsync(toEmail, composer.SprintStarted(
            sprintName, projectName,
            $"{composer.AppUrl}/workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}"));

    public Task SendTaskStatusChangedEmailAsync(
        string toEmail, string taskTitle, string projectName, string newStatus, string changedBy,
        string workspaceId, string projectId, string taskId)
        => SendAsync(toEmail, composer.TaskStatusChanged(
            taskTitle, projectName, newStatus, changedBy, TaskUrl(workspaceId, projectId, taskId)));

    public Task SendCommentAddedEmailAsync(
        string toEmail, string taskTitle, string projectName, string comment, string commenterName,
        string workspaceId, string projectId, string taskId)
        => SendAsync(toEmail, composer.CommentAdded(
            taskTitle, projectName, comment, commenterName, TaskUrl(workspaceId, projectId, taskId)));

    public Task SendRoleChangedEmailAsync(
        string toEmail, string workspaceName, string newRole, string changedBy, string workspaceId)
        => SendAsync(toEmail, composer.RoleChanged(
            workspaceName, newRole, changedBy, WorkspaceUrl(workspaceId)));

    public Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail, string workspaceName, string removedBy, string workspaceId)
        => SendAsync(toEmail, composer.RemovedFromWorkspace(
            workspaceName, removedBy, WorkspaceUrl(workspaceId)));

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail, string workspaceName, string invitedBy, string role, string workspaceId)
        => SendAsync(toEmail, composer.WorkspaceInvite(
            workspaceName, invitedBy, role, WorkspaceUrl(workspaceId)));

    private string TaskUrl(string workspaceId, string projectId, string taskId) =>
        $"{composer.AppUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";

    private string WorkspaceUrl(string workspaceId) =>
        $"{composer.AppUrl}/workspaces/{workspaceId}";

    private async Task SendAsync(string to, ComposedEmail message)
    {
        // Message-ID: an SMTP server will happily forward the same message
        // twice — a retry after a timeout, a duplicated queue entry — and two
        // copies of a verification mail look like a phishing attempt. A stable
        // id lets the receiving side collapse them.
        var mime = new MimeMessage();
        mime.From.Add(new MailboxAddress(options.FromName, options.FromEmail));
        mime.To.Add(MailboxAddress.Parse(to));
        mime.Subject = message.Subject;
        mime.Body = new TextPart(TextFormat.Html) { Text = message.Html };
        mime.MessageId = $"<{options.MessageIdPrefix}-{Guid.NewGuid():N}@devflow>";

        // Open a connection per send rather than holding one open. The volume
        // here is a handful of signups a day; a pooled connection would cost
        // more in idle-timeout handling than it saves in handshakes, and a
        // long-lived SMTP session is just another thing to go stale silently.
        using var client = new SmtpClient();
        await client.ConnectAsync(options.Host, options.Port, options.UseStartTls
            ? SecureSocketOptions.StartTls
            : SecureSocketOptions.None);

        if (!string.IsNullOrWhiteSpace(options.Username))
        {
            await client.AuthenticateAsync(options.Username, options.Password);
        }

        await client.SendAsync(mime);
        await client.DisconnectAsync(true);

        logger.LogInformation(
            "SMTP sent {Subject} to {Recipient} via {Host}.", message.Subject, to, options.Host);
    }
}
