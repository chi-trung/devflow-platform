using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class GitHubRepository(DevFlowDbContext dbContext) : IGitHubRepository
{
    public async Task<GitHubIntegration?> GetByProjectIdAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.GitHubIntegrations
            .FirstOrDefaultAsync(gi => gi.ProjectId == projectId, cancellationToken);
    }

    public async Task<GitHubIntegration?> GetByRepositoryUrlAsync(string repositoryUrl, CancellationToken cancellationToken = default)
    {
        return await dbContext.GitHubIntegrations
            .FirstOrDefaultAsync(gi => gi.RepositoryUrl == repositoryUrl, cancellationToken);
    }

    public async Task AddIntegrationAsync(GitHubIntegration integration, CancellationToken cancellationToken = default)
    {
        await dbContext.GitHubIntegrations.AddAsync(integration, cancellationToken);
    }

    public void RemoveIntegration(GitHubIntegration integration)
    {
        dbContext.GitHubIntegrations.Remove(integration);
    }

    public async Task<IReadOnlyList<PullRequest>> GetPullRequestsByProjectAsync(Guid projectId, CancellationToken cancellationToken = default)
    {
        return await dbContext.PullRequests
            .Where(pr => pr.ProjectId == projectId)
            .OrderByDescending(pr => pr.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task AddPullRequestAsync(PullRequest pullRequest, CancellationToken cancellationToken = default)
    {
        await dbContext.PullRequests.AddAsync(pullRequest, cancellationToken);
    }
}
