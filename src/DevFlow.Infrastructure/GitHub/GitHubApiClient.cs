using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.GitHub;

/// <summary>
/// GitHub REST API client for repo operations. Uses the named "GitHubApi"
/// HttpClient (base address + User-Agent set in DI); the OAuth access token is
/// applied per request — the factory pools handler instances, so anything set
/// on DefaultRequestHeaders would leak across users.
/// </summary>
public sealed class GitHubApiClient(IHttpClientFactory httpClientFactory) : IGitHubApiClient
{
    private const string JsonMediaType = "application/vnd.github+json";

    private readonly HttpClient _client = httpClientFactory.CreateClient("GitHubApi");

    public async Task<GitHubRepositoryInfo> GetRepositoryAsync(
        string owner, string repo, string accessToken, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(HttpMethod.Get, $"repos/{owner}/{repo}", accessToken, cancellationToken);
        using var json = await ParseAsync(response, cancellationToken);
        var defaultBranch = json.RootElement.TryGetProperty("default_branch", out var branch)
            ? branch.GetString() ?? "main"
            : "main";
        return new GitHubRepositoryInfo(defaultBranch);
    }

    public async Task<GitHubBranchRef> GetBranchRefAsync(
        string owner, string repo, string branch, string accessToken, CancellationToken cancellationToken = default)
    {
        using var response = await SendAsync(
            HttpMethod.Get, $"repos/{owner}/{repo}/git/ref/heads/{branch}", accessToken, cancellationToken);
        using var json = await ParseAsync(response, cancellationToken);
        var root = json.RootElement;

        // The ref object carries the head commit sha; fetching the commit gives
        // us its tree, which the starter commit must point at.
        var sha = root.GetProperty("object").GetProperty("sha").GetString()
            ?? throw new GitHubApiException((int)response.StatusCode, "GitHub returned a ref without a sha.");

        using var commitResponse = await SendAsync(
            HttpMethod.Get, $"repos/{owner}/{repo}/git/commits/{sha}", accessToken, cancellationToken);
        using var commitJson = await ParseAsync(commitResponse, cancellationToken);
        var treeSha = commitJson.RootElement.GetProperty("tree").GetProperty("sha").GetString()
            ?? throw new GitHubApiException((int)commitResponse.StatusCode, "GitHub returned a commit without a tree.");

        return new GitHubBranchRef(sha, treeSha);
    }

    public async Task<GitHubNewCommit> CreateCommitAsync(
        string owner, string repo, string message, string treeSha, string parentSha,
        string accessToken, CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.Serialize(new
        {
            message,
            tree = treeSha,
            parents = new[] { parentSha },
        });

        using var response = await SendAsync(
            HttpMethod.Post, $"repos/{owner}/{repo}/git/commits", accessToken, cancellationToken, body);
        using var json = await ParseAsync(response, cancellationToken);
        var sha = json.RootElement.GetProperty("sha").GetString()
            ?? throw new GitHubApiException((int)response.StatusCode, "GitHub did not return a commit sha.");
        return new GitHubNewCommit(sha);
    }

    public async Task CreateRefAsync(
        string owner, string repo, string refName, string sha,
        string accessToken, CancellationToken cancellationToken = default)
    {
        var body = JsonSerializer.Serialize(new
        {
            @ref = $"refs/heads/{refName}",
            sha,
        });

        using var response = await SendAsync(
            HttpMethod.Post, $"repos/{owner}/{repo}/git/refs", accessToken, cancellationToken, body);
        await ParseAsync(response, cancellationToken);
    }

    public async Task<GitHubCreatedPr> CreatePullRequestAsync(
        string owner, string repo, string title, string head, string @base, string body,
        string accessToken, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Serialize(new
        {
            title,
            head,
            @base,
            body,
        });

        using var response = await SendAsync(
            HttpMethod.Post, $"repos/{owner}/{repo}/pulls", accessToken, cancellationToken, payload);
        using var json = await ParseAsync(response, cancellationToken);
        var root = json.RootElement;

        var number = root.TryGetProperty("number", out var numberEl) ? numberEl.GetInt32() : 0;
        var htmlUrl = root.TryGetProperty("html_url", out var urlEl) ? urlEl.GetString() ?? string.Empty : string.Empty;
        var login = root.TryGetProperty("user", out var userEl) && userEl.TryGetProperty("login", out var loginEl)
            ? loginEl.GetString()
            : null;

        return new GitHubCreatedPr(number, htmlUrl, login);
    }

    private async Task<HttpResponseMessage> SendAsync(
        HttpMethod method, string path, string accessToken, CancellationToken cancellationToken, string? jsonBody = null)
    {
        using var request = new HttpRequestMessage(method, path)
        {
            Content = jsonBody is null
                ? null
                : new StringContent(jsonBody, Encoding.UTF8, JsonMediaType),
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue(JsonMediaType));
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        var response = await _client.SendAsync(request, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var detail = await ExtractErrorAsync(response, cancellationToken);
            throw new GitHubApiException((int)response.StatusCode, detail);
        }

        return response;
    }

    private static async Task<JsonDocument> ParseAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        try
        {
            return JsonDocument.Parse(content);
        }
        catch (JsonException)
        {
            throw new GitHubApiException((int)response.StatusCode, "GitHub returned an unexpected response body.");
        }
    }

    /// <summary>Extracts an actionable message from GitHub's error envelope —
    /// its 422 bodies carry {message, errors:[{message}]} explaining exactly
    /// what failed (branch exists, PR already exists, no commits, …).</summary>
    private static async Task<string> ExtractErrorAsync(HttpResponseMessage response, CancellationToken cancellationToken)
    {
        var content = await response.Content.ReadAsStringAsync(cancellationToken);
        try
        {
            using var json = JsonDocument.Parse(content);
            var root = json.RootElement;
            var message = root.TryGetProperty("message", out var messageEl) ? messageEl.GetString() : null;

            string? firstError = null;
            if (root.TryGetProperty("errors", out var errorsEl) && errorsEl.ValueKind == JsonValueKind.Array)
            {
                foreach (var error in errorsEl.EnumerateArray())
                {
                    if (error.TryGetProperty("message", out var errorEl))
                    {
                        firstError = errorEl.GetString();
                        break;
                    }
                }
            }

            var detail = string.Join(" ", new[] { message, firstError }.Where(part => !string.IsNullOrWhiteSpace(part)));
            return string.IsNullOrWhiteSpace(detail)
                ? $"GitHub request failed with status {(int)response.StatusCode}."
                : detail;
        }
        catch (JsonException)
        {
            return string.IsNullOrWhiteSpace(content)
                ? $"GitHub request failed with status {(int)response.StatusCode}."
                : content;
        }
    }
}
