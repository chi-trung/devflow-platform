using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DevFlow.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/v1/workspaces/{workspaceId:guid}/projects/{projectId:guid}/github")]
public sealed class GitHubController(ISender sender) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(Application.Features.GitHub.GitHubIntegrationResponse), StatusCodes.Status200OK)]
    public async Task<IActionResult> GetIntegration(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.GitHub.GetGitHubIntegrationQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("link")]
    [ProducesResponseType(typeof(Application.Features.GitHub.GitHubIntegrationResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> Link(
        Guid workspaceId,
        Guid projectId,
        LinkGitHubRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.GitHub.LinkGitHubCommand(workspaceId, projectId, request.RepositoryUrl),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpDelete]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Unlink(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        await sender.Send(
            new Application.Features.GitHub.UnlinkGitHubCommand(workspaceId, projectId),
            cancellationToken);

        return NoContent();
    }

    [HttpGet("prs")]
    [ProducesResponseType(typeof(List<Application.Features.GitHub.PullRequestResponse>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListPRs(
        Guid workspaceId,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.GitHub.ListPullRequestsQuery(workspaceId, projectId),
            cancellationToken);

        return Ok(result);
    }

    [HttpPost("prs")]
    [ProducesResponseType(typeof(Application.Features.GitHub.PullRequestResponse), StatusCodes.Status201Created)]
    public async Task<IActionResult> AddPR(
        Guid workspaceId,
        Guid projectId,
        AddPullRequestRequest request,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(
            new Application.Features.GitHub.AddPullRequestCommand(
                workspaceId, projectId, request.Title, request.Url, request.Status, request.Author),
            cancellationToken);

        return StatusCode(StatusCodes.Status201Created, result);
    }
}

public sealed record LinkGitHubRequest(string RepositoryUrl);

public sealed record AddPullRequestRequest(
    string Title,
    string Url,
    string Status,
    string? Author);
