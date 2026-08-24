using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Features.Email;
using Microsoft.Extensions.Configuration;

namespace DevFlow.Infrastructure.Email;

public sealed class ResendEmailService(HttpClient httpClient, IConfiguration configuration) : IEmailService
{
    private readonly string _apiKey = configuration["RESEND_API_KEY"]
        ?? throw new InvalidOperationException("RESEND_API_KEY is not configured.");

    private readonly string _fromEmail = configuration["RESEND_FROM_EMAIL"] ?? "DevFlow <onboarding@resend.dev>";

    private string FrontendUrl =>
        (configuration["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/');

    public Task SendTaskAssignedEmailAsync(
        string toEmail, string taskTitle, string projectName, string assignedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";
        return SendEmailAsync(toEmail, $"New task assigned to you — {taskTitle}", $"""
            <h2>You've been assigned a task</h2>
            <p><strong>{assignedBy}</strong> assigned you to <strong>{taskTitle}</strong> in project <strong>{projectName}</strong>.</p>
            <p><a href="{taskUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendMentionEmailAsync(
        string toEmail, string taskTitle, string comment, string mentionedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";
        return SendEmailAsync(toEmail, $"You were mentioned in a comment — {taskTitle}", $"""
            <h2>You were mentioned</h2>
            <p><strong>{mentionedBy}</strong> mentioned you in a comment on <strong>{taskTitle}</strong>:</p>
            <blockquote style="border-left:3px solid #14b8a6;padding-left:12px;color:#555;">{comment}</blockquote>
            <p><a href="{taskUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendSprintStartedEmailAsync(
        string toEmail, string sprintName, string projectName,
        string workspaceId, string projectId, string sprintId)
    {
        var sprintUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/sprints/{sprintId}";
        return SendEmailAsync(toEmail, $"Sprint started — {sprintName}", $"""
            <h2>Sprint started</h2>
            <p>Sprint <strong>{sprintName}</strong> has started in project <strong>{projectName}</strong>.</p>
            <p><a href="{sprintUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendTaskStatusChangedEmailAsync(
        string toEmail, string taskTitle, string projectName, string newStatus, string changedBy,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";
        return SendEmailAsync(toEmail, $"Task status changed — {taskTitle}", $"""
            <h2>Task status changed</h2>
            <p><strong>{changedBy}</strong> moved <strong>{taskTitle}</strong> to <strong>{newStatus}</strong> in project <strong>{projectName}</strong>.</p>
            <p><a href="{taskUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendCommentAddedEmailAsync(
        string toEmail, string taskTitle, string projectName, string comment, string commenterName,
        string workspaceId, string projectId, string taskId)
    {
        var taskUrl = $"{FrontendUrl}/workspaces/{workspaceId}/projects/{projectId}/board?selectedTaskId={taskId}";
        return SendEmailAsync(toEmail, $"New comment on {taskTitle}", $"""
            <h2>New comment</h2>
            <p><strong>{commenterName}</strong> commented on <strong>{taskTitle}</strong> in project <strong>{projectName}</strong>:</p>
            <blockquote style="border-left:3px solid #14b8a6;padding-left:12px;color:#555;">{comment}</blockquote>
            <p><a href="{taskUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendRoleChangedEmailAsync(
        string toEmail, string workspaceName, string newRole, string changedBy, string workspaceId)
    {
        var workspaceUrl = $"{FrontendUrl}/workspaces/{workspaceId}";
        return SendEmailAsync(toEmail, $"Your role changed in {workspaceName}", $"""
            <h2>Role changed</h2>
            <p><strong>{changedBy}</strong> changed your role in workspace <strong>{workspaceName}</strong> to <strong>{newRole}</strong>.</p>
            <p><a href="{workspaceUrl}">Open DevFlow →</a></p>
        """);
    }

    public Task SendRemovedFromWorkspaceEmailAsync(
        string toEmail, string workspaceName, string removedBy, string workspaceId)
    {
        var workspaceUrl = $"{FrontendUrl}/workspaces/{workspaceId}";
        return SendEmailAsync(toEmail, $"You were removed from {workspaceName}", $"""
            <h2>Removed from workspace</h2>
            <p><strong>{removedBy}</strong> removed you from workspace <strong>{workspaceName}</strong>.</p>
            <p><a href="{workspaceUrl}">Open DevFlow →</a></p>
        """);
    }

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

        var response = await httpClient.SendAsync(request);

        if (!response.IsSuccessStatusCode)
        {
            var body = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Resend API error {(int)response.StatusCode}: {body}");
        }
    }
}
