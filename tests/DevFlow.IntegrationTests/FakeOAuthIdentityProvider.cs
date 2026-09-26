using DevFlow.Application.Common.Interfaces;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Stands in for Google and GitHub in the test host.
///
/// The real providers do a live HTTPS call to a third party, which CI cannot
/// reach and would make tests depend on someone else's uptime. This one treats
/// the authorization code as a lookup key into <see cref="Identities"/>, so a
/// test says "this code means this identity" and the rest of the pipeline —
/// controller, [Authorize], conflict mapping, EF writes — runs for real.
///
/// The handler picks a provider by matching <see cref="IExternalIdentityProvider.Provider"/>,
/// so one instance is registered per name; both share the same identity table.
///
/// Registered in place of the real ones by <see cref="DevFlowWebApplicationFactory"/>.
/// </summary>
public sealed class FakeOAuthIdentityProvider(string provider) : IExternalIdentityProvider
{
    /// <summary>
    /// Authorization code → the identity the "provider" will report. Static so
    /// a test can register an identity before making the request that uses it.
    /// Safe without locking: every integration test in this project runs
    /// serially (see IntegrationTestCollection).
    /// </summary>
    public static Dictionary<string, ExternalIdentity> Identities { get; } = new(StringComparer.Ordinal);

    public string Provider { get; } = provider;

    public Task<ExternalIdentity> GetProfileAsync(
        string provider,
        string code,
        string codeVerifier,
        CancellationToken cancellationToken = default)
    {
        if (!Identities.TryGetValue(code, out var identity))
        {
            // Mirrors the real providers: a code the provider will not honour
            // is an UnauthorizedAccessException, not a validation error.
            throw new UnauthorizedAccessException($"The {provider} authorization code was rejected.");
        }

        return Task.FromResult(identity);
    }

    /// <summary>Registers an identity and returns the code that will yield it.</summary>
    public static string Register(string subject, string email, string? name = null)
    {
        var code = $"code-{Guid.NewGuid():N}";
        Identities[code] = new ExternalIdentity(
            subject,
            email,
            name ?? "Linked User",
            AccessToken: $"token-{Guid.NewGuid():N}");
        return code;
    }
}
