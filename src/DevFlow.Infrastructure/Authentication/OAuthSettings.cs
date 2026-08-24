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
}
