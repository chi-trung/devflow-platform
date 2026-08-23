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
}
