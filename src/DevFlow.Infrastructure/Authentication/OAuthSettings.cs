namespace DevFlow.Infrastructure.Authentication;

public sealed class OAuthSettings
{
    public const string SectionName = "OAuth";

    /// <summary>Google OAuth client id issued from the Google Cloud Console.</summary>
    public string GoogleClientId { get; init; } = string.Empty;

    /// <summary>Google OAuth client secret issued from the Google Cloud Console.</summary>
    public string GoogleClientSecret { get; init; } = string.Empty;

    /// <summary>Redirect URI registered with Google. Must match the frontend's
    /// <c>VITE_GOOGLE_REDIRECT_URI</c> exactly.</summary>
    public string GoogleRedirectUri { get; init; } = string.Empty;

    /// <summary>GitHub OAuth App client id issued from github.com/settings/developers.</summary>
    public string GitHubClientId { get; init; } = string.Empty;

    /// <summary>GitHub OAuth App client secret issued from github.com/settings/developers.</summary>
    public string GitHubClientSecret { get; init; } = string.Empty;

    /// <summary>Authorization callback URL registered with the GitHub OAuth App.
    /// Must match the frontend's /login route exactly.</summary>
    public string GitHubRedirectUri { get; init; } = string.Empty;
}
