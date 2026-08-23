using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class GitHubIntegration : BaseEntity, IAuditableEntity
{
    private GitHubIntegration()
    {
    }

    private GitHubIntegration(Guid projectId, string repositoryUrl, string? webhookSecret)
    {
        ProjectId = projectId;
        RepositoryUrl = repositoryUrl;
        WebhookSecret = webhookSecret;
        IsActive = true;
    }

    public Guid ProjectId { get; private set; }

    public string RepositoryUrl { get; private set; } = string.Empty;

    public string? WebhookSecret { get; private set; }

    public bool IsActive { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static GitHubIntegration Create(Guid projectId, string repositoryUrl, string? webhookSecret)
    {
        if (string.IsNullOrWhiteSpace(repositoryUrl))
            throw new ArgumentException("Repository URL is required.", nameof(repositoryUrl));

        return new GitHubIntegration(projectId, repositoryUrl.Trim(), webhookSecret);
    }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;

    public void UpdateWebhookSecret(string secret)
    {
        WebhookSecret = secret ?? throw new ArgumentNullException(nameof(secret));
    }
}
