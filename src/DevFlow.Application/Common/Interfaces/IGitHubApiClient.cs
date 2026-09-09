namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Thin typed client over the GitHub REST API for repo operations (branches,
/// commits, pull requests). The access token is a per-call parameter —
/// never baked into shared HttpClient headers — and comes from the caller's
/// stored GitHub OAuth login (scope "repo").
/// </summary>
public interface IGitHubApiClient
{
    /// <summary>Fetches repo metadata (only the default branch is needed).</summary>
    Task<GitHubRepositoryInfo> GetRepositoryAsync(
        string owner, string repo, string accessToken, CancellationToken cancellationToken = default);

    /// <summary>Fetches a branch head: its commit sha and that commit's tree sha.</summary>
    Task<GitHubBranchRef> GetBranchRefAsync(
        string owner, string repo, string branch, string accessToken, CancellationToken cancellationToken = default);

    /// <summary>
    /// Creates a commit pointing at an existing tree (a "starter" empty commit
    /// so a fresh branch has content GitHub can open a PR against).
    /// </summary>
    Task<GitHubNewCommit> CreateCommitAsync(
        string owner, string repo, string message, string treeSha, string parentSha,
        string accessToken, CancellationToken cancellationToken = default);

    /// <summary>Creates a branch head ref, e.g. refName "feature/x".</summary>
    Task CreateRefAsync(
        string owner, string repo, string refName, string sha,
        string accessToken, CancellationToken cancellationToken = default);

    /// <summary>Opens a pull request. head/base are plain branch names.</summary>
    Task<GitHubCreatedPr> CreatePullRequestAsync(
        string owner, string repo, string title, string head, string @base, string body,
        string accessToken, CancellationToken cancellationToken = default);
}

public sealed record GitHubRepositoryInfo(string DefaultBranch);

public sealed record GitHubBranchRef(string Sha, string TreeSha);

public sealed record GitHubNewCommit(string Sha);

public sealed record GitHubCreatedPr(int Number, string HtmlUrl, string? UserLogin);

/// <summary>
/// A failed GitHub REST call. StatusCode is GitHub's HTTP status; Detail is an
/// actionable message extracted from the response body when possible.
/// </summary>
public sealed class GitHubApiException(int statusCode, string detail) : Exception(detail)
{
    public int StatusCode { get; } = statusCode;
}
