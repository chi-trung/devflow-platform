using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.GitHub;

// Link GitHub repo to project
[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record LinkGitHubCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string RepositoryUrl) : IRequest<GitHubIntegrationResponse>, IWorkspaceRequest;

public class LinkGitHubHandler(
    IGitHubRepository gitHubRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<LinkGitHubCommand, GitHubIntegrationResponse>
{
    public async Task<GitHubIntegrationResponse> Handle(LinkGitHubCommand request, CancellationToken ct)
    {
        var existing = await gitHubRepository.GetByProjectIdAsync(request.ProjectId, ct);
        if (existing != null)
            throw new ConflictException("GitHub integration already exists for this project.");

        var integration = Domain.Entities.GitHubIntegration.Create(
            request.ProjectId,
            request.RepositoryUrl,
            Guid.NewGuid().ToString("N"));

        await gitHubRepository.AddIntegrationAsync(integration, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return new GitHubIntegrationResponse(
            integration.Id,
            integration.ProjectId,
            integration.RepositoryUrl,
            integration.IsActive,
            integration.CreatedAtUtc);
    }
}

// Get GitHub integration for project
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record GetGitHubIntegrationQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<GitHubIntegrationResponse?>, IWorkspaceRequest;

public class GetGitHubIntegrationHandler(
    IGitHubRepository gitHubRepository)
    : IRequestHandler<GetGitHubIntegrationQuery, GitHubIntegrationResponse?>
{
    public async Task<GitHubIntegrationResponse?> Handle(GetGitHubIntegrationQuery request, CancellationToken ct)
    {
        var integration = await gitHubRepository.GetByProjectIdAsync(request.ProjectId, ct);
        if (integration == null) return null;

        return new GitHubIntegrationResponse(
            integration.Id,
            integration.ProjectId,
            integration.RepositoryUrl,
            integration.IsActive,
            integration.CreatedAtUtc);
    }
}

// Unlink GitHub repo
[RequireWorkspaceRole(WorkspaceRole.Admin)]
public sealed record UnlinkGitHubCommand(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest, IWorkspaceRequest;

public class UnlinkGitHubHandler(
    IGitHubRepository gitHubRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<UnlinkGitHubCommand>
{
    public async Task Handle(UnlinkGitHubCommand request, CancellationToken ct)
    {
        var integration = await gitHubRepository.GetByProjectIdAsync(request.ProjectId, ct)
            ?? throw new NotFoundException("GitHub integration", request.ProjectId);

        gitHubRepository.RemoveIntegration(integration);
        await unitOfWork.SaveChangesAsync(ct);
    }
}

// List pull requests for project
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListPullRequestsQuery(
    Guid WorkspaceId,
    Guid ProjectId) : IRequest<List<PullRequestResponse>>, IWorkspaceRequest;

public class ListPullRequestsHandler(
    IGitHubRepository gitHubRepository)
    : IRequestHandler<ListPullRequestsQuery, List<PullRequestResponse>>
{
    public async Task<List<PullRequestResponse>> Handle(ListPullRequestsQuery request, CancellationToken ct)
    {
        var prs = await gitHubRepository.GetPullRequestsByProjectAsync(request.ProjectId, ct);

        return prs.Select(pr => new PullRequestResponse(
            pr.Id,
            pr.Title,
            pr.Url,
            pr.Status,
            pr.Author,
            pr.LinkedTaskId,
            pr.CreatedAtUtc)).ToList();
    }
}

// Add pull request
[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record AddPullRequestCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Title,
    string Url,
    string Status,
    string? Author) : IRequest<PullRequestResponse>, IWorkspaceRequest;

public class AddPullRequestHandler(
    IGitHubRepository gitHubRepository,
    IUnitOfWork unitOfWork)
    : IRequestHandler<AddPullRequestCommand, PullRequestResponse>
{
    public async Task<PullRequestResponse> Handle(AddPullRequestCommand request, CancellationToken ct)
    {
        var pr = Domain.Entities.PullRequest.Create(
            request.ProjectId,
            request.Title,
            request.Url,
            request.Status,
            request.Author);

        await gitHubRepository.AddPullRequestAsync(pr, ct);
        await unitOfWork.SaveChangesAsync(ct);

        return new PullRequestResponse(
            pr.Id,
            pr.Title,
            pr.Url,
            pr.Status,
            pr.Author,
            pr.LinkedTaskId,
            pr.CreatedAtUtc);
    }
}
