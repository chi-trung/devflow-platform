using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Features.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Email;

/// <summary>
/// Delivers over Resend's HTTP API.
///
/// The wording of every message lives in <see cref="EmailComposer"/>, shared
/// with the SMTP transport — this class only turns a composed message into a
/// JSON request.
/// </summary>
public sealed class ResendEmailService(
    HttpClient httpClient,
    EmailComposer composer,
    IConfiguration configuration,
    ILogger<ResendEmailService> logger) : IEmailService
{
    private readonly string _apiKey = configuration["RESEND_API_KEY"]
        ?? throw new InvalidOperationException("RESEND_API_KEY is not configured.");

    private readonly string _fromEmail = configuration["RESEND_FROM_EMAIL"] ?? "DevFlow <onboarding@resend.dev>";

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
        var payload = new
        {
            from = _fromEmail,
            to = new[] { to },
            subject = message.Subject,
            html = message.Html,
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails")
        {
            Content = content,
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _apiKey);

        using var response = await httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            logger.LogError(
                "Resend rejected {Subject} for {Recipient}: {StatusCode} {Body}",
                message.Subject,
                to,
                (int)response.StatusCode,
                body);
            throw new InvalidOperationException($"Resend API error {(int)response.StatusCode}: {body}");
        }
    }
}
