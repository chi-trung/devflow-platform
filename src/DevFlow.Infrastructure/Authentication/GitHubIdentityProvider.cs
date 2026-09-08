using System.Net.Http.Headers;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.Authentication;

/// <summary>
/// GitHub OAuth App (Authorization Code, no PKCE) identity provider. Owns the
/// raw HTTP calls: exchanges the one-time code for an access token, fetches the
/// profile, and resolves a verified email from the emails endpoint (the profile
/// email is null when the user keeps addresses private). Render: redeploy needed
/// for new env vars to load.
/// </summary>
public sealed class GitHubIdentityProvider(
    IHttpClientFactory httpClientFactory,
    Microsoft.Extensions.Options.IOptions<OAuthSettings> options) : IExternalIdentityProvider
{
    private const string TokenEndpoint = "https://github.com/login/oauth/access_token";
    private const string UserEndpoint = "https://api.github.com/user";
    private const string UserEmailsEndpoint = "https://api.github.com/user/emails";

    private readonly OAuthSettings _settings = options.Value;

    /// <inheritdoc />
    public string Provider => "github";

    public async Task<ExternalIdentity> GetProfileAsync(
        string provider,
        string code,
        string codeVerifier,
        CancellationToken cancellationToken = default)
    {
        // GitHub's classic OAuth App flow has no PKCE verifier; the argument is
        // part of the shared interface and stays unused here.
        _ = codeVerifier;

        if (!string.Equals(provider, "github", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException($"Unsupported OAuth provider: {provider}.");
        }

        var client = httpClientFactory.CreateClient("OAuth");
        client.DefaultRequestHeaders.UserAgent.ParseAdd("DevFlow");

        // 1. Exchange the authorization code for an access token. The Accept
        // header is required — GitHub answers form-encoded without it.
        var request = new HttpRequestMessage(HttpMethod.Post, TokenEndpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = _settings.GitHubClientId,
                ["client_secret"] = _settings.GitHubClientSecret,
                ["code"] = code,
                ["redirect_uri"] = _settings.GitHubRedirectUri,
            }),
        };
        request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

        using var tokenResponse = await client.SendAsync(request, cancellationToken);
        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new UnauthorizedAccessException("GitHub rejected the authorization code.");
        }

        using var tokenJson = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
        var accessToken = tokenJson.RootElement.TryGetProperty("access_token", out var at)
            ? at.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new UnauthorizedAccessException("GitHub did not return an access token.");
        }

        // 2. Fetch the GitHub profile (id, name, public email).
        using var infoRequest = new HttpRequestMessage(HttpMethod.Get, UserEndpoint);
        infoRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var infoResponse = await client.SendAsync(infoRequest, cancellationToken);
        if (!infoResponse.IsSuccessStatusCode)
        {
            throw new UnauthorizedAccessException("Could not fetch the GitHub profile.");
        }

        using var infoJson = JsonDocument.Parse(await infoResponse.Content.ReadAsStringAsync(cancellationToken));
        var root = infoJson.RootElement;

        var subject = root.TryGetProperty("id", out var id)
            ? (id.ValueKind == JsonValueKind.Number ? id.GetInt64().ToString() : id.GetString())
            : null;
        var name = root.TryGetProperty("name", out var nm) ? nm.GetString() : null;

        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new UnauthorizedAccessException("GitHub profile is missing a subject.");
        }

        // 3. The profile email is null when "Keep my email addresses private" is
        // on, so resolve the primary verified email from the emails endpoint.
        var email = root.TryGetProperty("email", out var em) ? em.GetString() : null;
        if (string.IsNullOrWhiteSpace(email))
        {
            email = await GetPrimaryVerifiedEmailAsync(client, accessToken, cancellationToken);
        }

        if (string.IsNullOrWhiteSpace(email))
        {
            throw new UnauthorizedAccessException("GitHub profile is missing a verified email.");
        }

        return new ExternalIdentity(subject, email.Trim(), name ?? string.Empty, accessToken);
    }

    private static async Task<string?> GetPrimaryVerifiedEmailAsync(
        HttpClient client,
        string accessToken,
        CancellationToken cancellationToken)
    {
        using var emailsRequest = new HttpRequestMessage(HttpMethod.Get, UserEmailsEndpoint);
        emailsRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var emailsResponse = await client.SendAsync(emailsRequest, cancellationToken);
        if (!emailsResponse.IsSuccessStatusCode)
        {
            return null;
        }

        using var emailsJson = JsonDocument.Parse(await emailsResponse.Content.ReadAsStringAsync(cancellationToken));
        if (emailsJson.RootElement.ValueKind != JsonValueKind.Array)
        {
            return null;
        }

        foreach (var entry in emailsJson.RootElement.EnumerateArray())
        {
            var primary = entry.TryGetProperty("primary", out var pr) && pr.GetBoolean();
            var verified = entry.TryGetProperty("verified", out var vf) && vf.GetBoolean();
            if (primary && verified)
            {
                return entry.TryGetProperty("email", out var mail) ? mail.GetString() : null;
            }
        }

        return null;
    }
}
