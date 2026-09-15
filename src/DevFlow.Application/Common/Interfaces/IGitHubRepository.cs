using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IGitHubRepository
{
    Task<GitHubIntegration?> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<GitHubIntegration?> GetByRepositoryUrlAsync(string repositoryUrl, CancellationToken cancellationToken = default);

    Task AddIntegrationAsync(GitHubIntegration integration, CancellationToken cancellationToken = default);

    void RemoveIntegration(GitHubIntegration integration);

    Task<IReadOnlyList<PullRequest>> GetPullRequestsByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task AddPullRequestAsync(PullRequest pullRequest, CancellationToken cancellationToken = default);

    /// <summary>Scoped to <paramref name="projectId"/> on purpose: a caller
    /// who guesses a PR id from another project must get a miss, not a delete.
    /// Ids are never authorization.</summary>
    Task<PullRequest?> GetPullRequestByIdAsync(Guid projectId, Guid pullRequestId, CancellationToken cancellationToken = default);

    void RemovePullRequest(PullRequest pullRequest);
}
