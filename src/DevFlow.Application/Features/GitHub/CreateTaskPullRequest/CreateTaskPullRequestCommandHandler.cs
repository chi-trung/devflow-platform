using System.Text.RegularExpressions;
using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.GitHub.CreateTaskPullRequest;

public sealed partial class CreateTaskPullRequestCommandHandler(
    IProjectRepository projectRepository,
    ITaskItemRepository taskItemRepository,
    IGitHubRepository gitHubRepository,
    ISocialLoginRepository socialLoginRepository,
    IGitHubApiClient gitHubApiClient,
    IUserContext userContext,
    IUnitOfWork unitOfWork)
    : IRequestHandler<CreateTaskPullRequestCommand, PullRequestResponse>
{
    private const string GitHubProvider = "github";
    private const int MaxSlugLength = 40;

    public async Task<PullRequestResponse> Handle(
        CreateTaskPullRequestCommand command,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);
        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var task = await taskItemRepository.GetByIdAsync(command.TaskId, cancellationToken);
        if (task is null || task.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(TaskItem), command.TaskId);
        }

        var integration = await gitHubRepository.GetByProjectIdAsync(command.ProjectId, cancellationToken);
        if (integration is null || !integration.IsActive)
        {
            throw new ConflictException("No active GitHub repository is linked to this project.");
        }

        var login = await socialLoginRepository.GetByUserAndProviderAsync(
            userContext.UserId, GitHubProvider, cancellationToken);
        if (login?.AccessToken is not { Length: > 0 } accessToken)
        {
            throw new ConflictException(
                "Sign in with GitHub to create branches and pull requests (repo scope required).");
        }

        var (owner, repo) = ParseRepository(integration.RepositoryUrl);

        var branchName = ResolveBranchName(command.BranchName, project.Key, task.Number, task.Title);
        var taskKey = Features.Tasks.TaskKey.Format(project.Key, task.Number);
        var commitMessage = $"{taskKey}: {task.Title}";
        var prTitle = $"{taskKey}: {task.Title}";

        // base discovery: never hardcode "main" — the linked repo decides.
        GitHubRepositoryInfo repository;
        try
        {
            repository = await gitHubApiClient.GetRepositoryAsync(owner, repo, accessToken, cancellationToken);
        }
        catch (GitHubApiException ex) when (ex.StatusCode == 401)
        {
            throw new ConflictException("Your GitHub token is no longer valid. Sign in with GitHub again.");
        }

        var baseRef = await gitHubApiClient.GetBranchRefAsync(owner, repo, repository.DefaultBranch, accessToken, cancellationToken);

        // The starter commit reuses the base tree — it carries no changes, it
        // only gives the new branch content GitHub needs to open a PR
        // (an empty head gets 422 "No commits between…").
        var commit = await gitHubApiClient.CreateCommitAsync(
            owner, repo, commitMessage, baseRef.TreeSha, baseRef.Sha, accessToken, cancellationToken);

        try
        {
            await gitHubApiClient.CreateRefAsync(owner, repo, branchName, commit.Sha, accessToken, cancellationToken);
        }
        catch (GitHubApiException ex) when (ex.StatusCode == 422)
        {
            // Branch already exists from an earlier attempt — reuse it and
            // keep going; the command is effectively idempotent.
        }

        var createdPr = await gitHubApiClient.CreatePullRequestAsync(
            owner, repo, prTitle, branchName, repository.DefaultBranch, commitMessage, accessToken, cancellationToken);

        var pr = Domain.Entities.PullRequest.Create(
            command.ProjectId,
            prTitle,
            createdPr.HtmlUrl,
            "Open",
            createdPr.UserLogin ?? string.Empty,
            branchName);
        pr.LinkToTask(task.Id);

        await gitHubRepository.AddPullRequestAsync(pr, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return new PullRequestResponse(
            pr.Id,
            pr.Title,
            pr.Url,
            pr.Status,
            pr.Author,
            pr.LinkedTaskId,
            pr.CreatedAtUtc,
            pr.HeadBranch);
    }

    private static string ResolveBranchName(string? requested, string projectKey, int number, string title)
    {
        if (!string.IsNullOrWhiteSpace(requested))
        {
            var trimmed = requested.Trim();
            return trimmed.StartsWith("refs/heads/", StringComparison.Ordinal)
                ? trimmed["refs/heads/".Length..]
                : trimmed;
        }

        // Lowercased end-to-end — the project key is stored uppercase ("DEV")
        // but branch conventions keep everything lower.
        var branch = $"{projectKey}-{number}-{Slugify(title)}".ToLowerInvariant();
        return branch;
    }

    private static string Slugify(string title)
    {
        var slug = SlugInvalidChars().Replace(title.ToLowerInvariant(), "-").Trim('-');
        return slug.Length <= MaxSlugLength ? slug : slug[..MaxSlugLength].Trim('-');
    }

    [GeneratedRegex(@"[^a-z0-9]+")]
    private static partial Regex SlugInvalidChars();

    /// <summary>Accepts https://github.com/owner/repo(.git), ssh git@…, and a
    /// trailing slash — whatever the link flow stored.</summary>
    private static (string Owner, string Repo) ParseRepository(string repositoryUrl)
    {
        var match = RepositoryUrlPattern().Match(repositoryUrl);
        if (!match.Success)
        {
            throw new ConflictException("The linked repository URL is not a GitHub repository.");
        }

        return (match.Groups["owner"].Value, match.Groups["repo"].Value);
    }

    [GeneratedRegex(@"github\.com[/:](?<owner>[^/]+)/(?<repo>[^/?#]+?)(?:\.git)?/?$")]
    private static partial Regex RepositoryUrlPattern();
}
