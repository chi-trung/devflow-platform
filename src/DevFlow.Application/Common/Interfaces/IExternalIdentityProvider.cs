using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Application.Common.Interfaces;

/// <summary>Profile returned by an external identity provider after code exchange.</summary>
public sealed record ExternalIdentity(
    string Subject,
    string Email,
    string Name,
    string? AccessToken = null);

/// <summary>
/// Exchanges a one-time authorization code with an external identity provider
/// (e.g. Google, GitHub) and returns the verified identity. Implementations
/// live in Infrastructure and own the raw HTTP calls; each handles the single
/// provider named by <see cref="Provider"/>.
/// </summary>
public interface IExternalIdentityProvider
{
    /// <summary>Provider name this implementation handles, e.g. "google".</summary>
    string Provider { get; }

    Task<ExternalIdentity> GetProfileAsync(
        string provider,
        string code,
        string codeVerifier,
        CancellationToken cancellationToken = default);
}
