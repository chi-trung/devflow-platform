using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Application.Common.Interfaces;

/// <summary>Profile returned by an external identity provider after code exchange.</summary>
public sealed record ExternalIdentity(
    string Subject,
    string Email,
    string Name);

/// <summary>
/// Exchanges a one-time authorization code with an external identity provider
/// (e.g. Google) and returns the verified identity. Implementations live in
/// Infrastructure and own the raw HTTP calls.
/// </summary>
public interface IExternalIdentityProvider
{
    Task<ExternalIdentity> GetProfileAsync(
        string provider,
        string code,
        string codeVerifier,
        CancellationToken cancellationToken = default);
}
