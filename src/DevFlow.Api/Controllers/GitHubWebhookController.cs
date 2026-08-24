using System.Security.Cryptography;
using System.Text;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Application.Features.GitHub;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DevFlow.Api.Controllers;

[ApiController]
[Route("api/v1/webhooks/github")]
public sealed class GitHubWebhookController(
    IGitHubRepository gitHubRepository,
    IActivityLogRepository activityLogRepository,
    ITaskItemRepository taskItemRepository,
    IProjectRepository projectRepository,
    IUnitOfWork unitOfWork,
    ILogger<GitHubWebhookController> logger) : ControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Receive(CancellationToken cancellationToken)
    {
        var signature = Request.Headers["X-Hub-Signature-256"].ToString();
        if (string.IsNullOrEmpty(signature))
            return Unauthorized();

        Request.EnableBuffering();
        using var reader = new StreamReader(Request.Body, Encoding.UTF8, detectEncodingFromByteOrderMarks: false, leaveOpen: true);
        var body = await reader.ReadToEndAsync(cancellationToken);
        Request.Body.Position = 0;

        var eventHeader = Request.Headers["X-GitHub-Event"].ToString();
        var deliveryId = Request.Headers["X-GitHub-Delivery"].ToString();

        var repositoryUrl = ExtractRepositoryUrl(body);
        if (string.IsNullOrEmpty(repositoryUrl))
        {
            return Accepted();
        }

        var integration = await gitHubRepository.GetByRepositoryUrlAsync(repositoryUrl, cancellationToken);
        if (integration == null)
        {
            logger.LogInformation("No GitHub integration found for webhook delivery {DeliveryId}", deliveryId);
            return Accepted();
        }

        if (!string.IsNullOrEmpty(integration.WebhookSecret))
        {
            if (!GitHubWebhookSignature.Verify(integration.WebhookSecret, body, signature))
            {
                return Unauthorized();
            }
        }

        var payload = DeserializePayload(body, eventHeader, integration.ProjectId);
        if (payload == null)
            return BadRequest();

        await GitHubWebhookHandler.ProcessAsync(
            payload,
            gitHubRepository,
            activityLogRepository,
            taskItemRepository,
            projectRepository,
            unitOfWork,
            cancellationToken);

        return Accepted();
    }

    private static string? ExtractRepositoryUrl(string body)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            if (doc.RootElement.TryGetProperty("repository", out var repo))
            {
                return repo.GetProperty("html_url").GetString();
            }
        }
        catch
        {
            // ignore parse errors
        }
        return null;
    }

    private static GitHubWebhookPayload? DeserializePayload(string body, string eventHeader, Guid projectId)
    {
        try
        {
            using var doc = System.Text.Json.JsonDocument.Parse(body);
            var root = doc.RootElement;

            string action = root.TryGetProperty("action", out var actionEl) ? actionEl.GetString() ?? "" : "";
            string? repositoryUrl = null;
            if (root.TryGetProperty("repository", out var repo))
            {
                repositoryUrl = repo.GetProperty("html_url").GetString();
            }

            string? senderLogin = null, senderName = null;
            if (root.TryGetProperty("sender", out var sender) && sender.TryGetProperty("login", out var loginEl))
            {
                senderLogin = loginEl.GetString();
                if (sender.TryGetProperty("name", out var nameEl))
                {
                    senderName = nameEl.GetString();
                }
            }

            return new GitHubWebhookPayload(
                Event: eventHeader,
                Action: action,
                RepositoryUrl: repositoryUrl,
                SenderLogin: senderLogin,
                SenderName: senderName,
                PrTitle: root.TryGetProperty("pull_request", out var pr) ? pr.GetProperty("title").GetString() : null,
                PrBody: root.TryGetProperty("pull_request", out var pr2) ? pr2.GetProperty("body").GetString() : null,
                PrUrl: root.TryGetProperty("pull_request", out var pr3) ? pr3.GetProperty("html_url").GetString() : null,
                PrState: root.TryGetProperty("pull_request", out var pr4) ? pr4.GetProperty("state").GetString() : null,
                PrMerged: root.TryGetProperty("pull_request", out var pr5) && pr5.TryGetProperty("merged", out var mergedEl) && mergedEl.ValueKind == System.Text.Json.JsonValueKind.True,
                IssueTitle: root.TryGetProperty("issue", out var issue) ? issue.GetProperty("title").GetString() : null,
                IssueBody: root.TryGetProperty("issue", out var issue2) ? issue2.GetProperty("body").GetString() : null,
                IssueUrl: root.TryGetProperty("issue", out var issue3) ? issue3.GetProperty("html_url").GetString() : null,
                IssueState: root.TryGetProperty("issue", out var issue4) ? issue4.GetProperty("state").GetString() : null,
                CommitMessage: root.TryGetProperty("commits", out var commits) && commits.GetArrayLength() > 0 ? commits[0].GetProperty("message").GetString() : null,
                Ref: root.TryGetProperty("ref", out var refEl) ? refEl.GetString() : null,
                ProjectId: projectId);
        }
        catch
        {
            return null;
        }
    }
}
