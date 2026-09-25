using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Features.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace DevFlow.Infrastructure.Email;

public sealed class ResendEmailService(
    HttpClient httpClient,
    IConfiguration configuration,
    ILogger<ResendEmailService> logger) : IEmailService
{
    private readonly string _apiKey = configuration["RESEND_API_KEY"]
        ?? throw new InvalidOperationException("RESEND_API_KEY is not configured.");

    private readonly string _fromEmail = configuration["RESEND_FROM_EMAIL"] ?? "DevFlow <onboarding@resend.dev>";

    private string FrontendUrl =>
        (configuration["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');

    private string AppUrl => FrontendUrl;

    private static string Heading(string text) =>
        $"<h1 style=\"margin:0 0 14px;font-size:20px;line-height:28px;font-weight:700;color:#0f172a;\">{EmailLayout.Encode(text)}</h1>";

    private static string Paragraph(string html) =>
        $"<p style=\"margin:0 0 14px;\">{html}</p>";

    private static string Strong(string? value) =>
        $"<strong style=\"color:#0f172a;\">{EmailLayout.Encode(value)}</strong>";

    public Task SendEmailVerificationAsync(
        string toEmail, string displayName, string verificationUrl)
    {
        return SendEmailAsync(
            toEmail,
            "Verify your DevFlow email address",
            EmailLayout.Render(
                preheader: $"Confirm your address to finish setting up your {Strong(displayName)} account.",
                body: string.Join(
                    string.Empty,
                    Heading($"Welcome, {displayName}"),
                    Paragraph(
                        "Confirm this address to activate your DevFlow account. " +
                        "It takes one click and keeps other people from signing up with your address."),
                    Paragraph(
                        "<span style=\"color:#64748b;\">This link works for 24 hours. " +
                        "If you did not create a DevFlow account, you can ignore this email.</span>")),
                actionUrl: verificationUrl,
                actionLabel: "Verify my email",
                appUrl: AppUrl));
    }

    public Task SendTaskAssignedEmailAsync(
        string toEmail, string taskTitle, string projectName, string assignedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = TaskUrl(workspaceId, projectId, taskId);
        return SendEmailAsync(
            toEmail,
            $"New task assigned to you — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{assignedBy} assigned you {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("A task was assigned to you"),
                    Paragraph($"{Strong(assignedBy)} assigned you {Strong(taskTitle)} in project {Strong(projectName)}.")),
                taskUrl, "Open task", AppUrl));
    }

    public Task SendMentionEmailAsync(
        string toEmail, string taskTitle, string comment, string mentionedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = TaskUrl(workspaceId, projectId, taskId);
        return SendEmailAsync(
            toEmail,
            $"You were mentioned in a comment — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{mentionedBy} mentioned you on {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("You were mentioned"),
                    Paragraph($"{Strong(mentionedBy)} mentioned you in a comment on {Strong(taskTitle)}:"),
                    EmailLayout.QuoteStart + EmailLayout.Encode(comment) + EmailLayout.QuoteEnd),
                taskUrl, "Read the comment", AppUrl));
    }

    public Task SendSprintStartedEmailAsync(
        string toEmail, string sprintName, string projectName,
        string workspaceId, string projectId, string sprintId)
    {
        var sprintUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}";
        return SendEmailAsync(
            toEmail,
            $"Sprint started — {sprintName}",
            EmailLayout.Render(
                preheader: $"Sprint {sprintName} has started.",
                body: string.Join(
                    string.Empty,
                    Heading("A sprint just started"),
                    Paragraph($"Sprint {Strong(sprintName)} has started in project {Strong(projectName)}. Time to move some work across.")),
                sprintUrl, "Open sprint board", AppUrl));
    }

    public Task SendTaskStatusChangedEmailAsync(
        string toEmail, string taskTitle, string projectName, string newStatus, string changedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = TaskUrl(workspaceId, projectId, taskId);
        return SendEmailAsync(
            toEmail,
            $"Task status changed — {taskTitle}",
            EmailLayout.Render(
                preheader: $"{taskTitle} is now {newStatus}.",
                body: string.Join(
                    string.Empty,
                    Heading("Task status changed"),
                    Paragraph($"{Strong(changedBy)} moved {Strong(taskTitle)} to {Strong(newStatus)} in project {Strong(projectName)}.")),
                taskUrl, "View the change", AppUrl));
    }

    public Task SendCommentAddedEmailAsync(
        string toEmail, string taskTitle, string projectName, string comment, string commenterName,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = TaskUrl(workspaceId, projectId, taskId);
        return SendEmailAsync(
            toEmail,
            $"New comment on {taskTitle}",
            EmailLayout.Render(
                preheader: $"{commenterName} commented on {taskTitle}.",
                body: string.Join(
                    string.Empty,
                    Heading("New comment"),
                    Paragraph($"{Strong(commenterName)} commented on {Strong(taskTitle)} in project {Strong(projectName)}:"),
                    EmailLayout.QuoteStart + EmailLayout.Encode(comment) + EmailLayout.QuoteEnd),
                taskUrl, "Read the comment", AppUrl));
    }

    public Task SendRoleChangedEmailAsync(
        string toEmail, string workspaceName, string newRole, string changedBy, string workspaceId)
    {
        var workspaceUrl = $"{FrontendUrl}/workspaces/{workspaceId}";
        return SendEmailAsync(
            toEmail,
            $"Your role changed in {workspaceName}",
            EmailLayout.Render(
                preheader: $"Your role in {workspaceName} is now {newRole}.",
                body: string.Join(
                    string.Empty,
                    Heading("Your role changed"),
                    Paragraph($"{Strong(changedBy)} changed your role in workspace {Strong(workspaceName)} to {Strong(newRole)}.")),
                workspaceUrl, "Open workspace", AppUrl));
    }

    public Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail, string workspaceName, string removedBy, string workspaceId)
    {
        var workspaceUrl = $"{FrontendUrl}/workspaces/{workspaceId}";
        return SendEmailAsync(
            toEmail,
            $"You were removed from {workspaceName}",
            EmailLayout.Render(
                preheader: $"You were removed from {workspaceName}.",
                body: string.Join(
                    string.Empty,
                    Heading("You were removed from a workspace"),
                    Paragraph($"{Strong(removedBy)} removed you from workspace {Strong(workspaceName)}. You no longer have access to its projects and tasks.")),
                workspaceUrl, "Sign in", AppUrl));
    }

    public Task SendWorkspaceInviteEmailAsync(
        string toEmail, string workspaceName, string invitedBy, string role, string workspaceId)
    {
        var workspaceUrl = $"{FrontendUrl}/workspaces/{workspaceId}";
        return SendEmailAsync(
            toEmail,
            $"You're invited to join {workspaceName}",
            EmailLayout.Render(
                preheader: $"{invitedBy} invited you to join {workspaceName}.",
                body: string.Join(
                    string.Empty,
                    Heading("You're invited to a workspace"),
                    Paragraph($"{Strong(invitedBy)} invited you to join {Strong(workspaceName)} as {Strong(role)}."),
                    Paragraph("Sign in to DevFlow and accept the invitation to start collaborating.")),
                workspaceUrl, "View the invitation", AppUrl));
    }

    private string TaskUrl(string workspaceId, string projectId, string taskId) =>
        $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";

    private async Task SendEmailAsync(string to, string subject, string htmlBody)
    {
        var payload = new
        {
            from = _fromEmail,
            to = new[] { to },
            subject,
            html = htmlBody,
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
                subject,
                to,
                (int)response.StatusCode,
                body);
            throw new InvalidOperationException($"Resend API error {(int)response.StatusCode}: {body}");
        }
    }
}
