namespace DevFlow.Application.Features.GitHub;

public sealed record GitHubIntegrationResponse(
    Guid Id,
    Guid ProjectId,
    string RepositoryUrl,
    bool IsActive,
    DateTimeOffset CreatedAtUtc,
    bool HasWebhookSecret = false);

public sealed record PullRequestResponse(
    Guid Id,
    string Title,
    string Url,
    string Status,
    string? Author,
    Guid? LinkedTaskId,
    DateTimeOffset CreatedAtUtc);
