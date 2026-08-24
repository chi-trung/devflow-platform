using System.Net.Http.Headers;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Infrastructure.Authentication;

/// <summary>
/// Google OAuth 2.0 (Authorization Code + PKCE) identity provider. Owns the raw
/// HTTP calls: exchanges the one-time code for an access token, then fetches
/// the userinfo endpoint to get a verified identity.
/// </summary>
public sealed class GoogleIdentityProvider(
    IHttpClientFactory httpClientFactory,
    Microsoft.Extensions.Options.IOptions<OAuthSettings> options) : IExternalIdentityProvider
{
    private const string TokenEndpoint = "https://oauth2.googleapis.com/token";
    private const string UserInfoEndpoint = "https://www.googleapis.com/oauth2/v3/userinfo";

    private readonly OAuthSettings _settings = options.Value;

    public async Task<ExternalIdentity> GetProfileAsync(
        string provider,
        string code,
        string codeVerifier,
        CancellationToken cancellationToken = default)
    {
        if (!string.Equals(provider, "google", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException($"Unsupported OAuth provider: {provider}.");
        }

        var client = httpClientFactory.CreateClient("OAuth");

        // 1. Exchange the authorization code for an access token.
        var tokenForm = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["code"] = code,
            ["client_id"] = _settings.GoogleClientId,
            ["client_secret"] = _settings.GoogleClientSecret,
            ["redirect_uri"] = _settings.GoogleRedirectUri,
            ["grant_type"] = "authorization_code",
            ["code_verifier"] = codeVerifier,
        });

        using var tokenResponse = await client.PostAsync(TokenEndpoint, tokenForm, cancellationToken);
        if (!tokenResponse.IsSuccessStatusCode)
        {
            throw new UnauthorizedAccessException("Google rejected the authorization code.");
        }

        using var tokenJson = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
        var accessToken = tokenJson.RootElement.TryGetProperty("access_token", out var at)
            ? at.GetString()
            : null;

        if (string.IsNullOrWhiteSpace(accessToken))
        {
            throw new UnauthorizedAccessException("Google did not return an access token.");
        }

        // 2. Fetch the user profile so we can identify the person.
        using var infoRequest = new HttpRequestMessage(HttpMethod.Get, UserInfoEndpoint);
        infoRequest.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        using var infoResponse = await client.SendAsync(infoRequest, cancellationToken);
        if (!infoResponse.IsSuccessStatusCode)
        {
            throw new UnauthorizedAccessException("Could not fetch the Google profile.");
        }

        using var infoJson = JsonDocument.Parse(await infoResponse.Content.ReadAsStringAsync(cancellationToken));
        var root = infoJson.RootElement;

        var subject = root.TryGetProperty("sub", out var sub) ? sub.GetString() : null;
        var email = root.TryGetProperty("email", out var em) ? em.GetString() : null;
        var name = root.TryGetProperty("name", out var nm) ? nm.GetString() : null;

        if (string.IsNullOrWhiteSpace(subject) || string.IsNullOrWhiteSpace(email))
        {
            throw new UnauthorizedAccessException("Google profile is missing a subject or email.");
        }

        return new ExternalIdentity(subject, email.Trim(), name ?? string.Empty);
    }
}
