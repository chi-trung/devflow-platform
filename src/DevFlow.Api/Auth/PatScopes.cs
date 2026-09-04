using System.Security.Claims;

namespace DevFlow.Api.Auth;

/// <summary>
/// Scope checks for personal-access-token requests. JWT requests (the web
/// app) are never restricted by this — scopes only bound what a PAT can do,
/// and every PAT carries at least one scope by construction.
/// </summary>
public static class PatScopes
{
    /// <summary>Scopes that authorize non-readonly (state-changing) calls.</summary>
    public static readonly string[] WriteScopes = ["write", "tasks", "admin"];

    public static IReadOnlyList<string> Of(ClaimsPrincipal user)
    {
        // The handler emits one space-joined claim, but accept one-claim-per-
        // scope too (FindAll across every df_scopes claim) so the helper is
        // robust to either claim shape.
        var scopes = user.FindAll(PatAuthenticationHandler.ScopesClaim)
            .SelectMany(c => c.Value.Split(' ',
                StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        return scopes;
    }

    public static bool CanWrite(ClaimsPrincipal user)
    {
        var scopes = Of(user);
        return scopes.Count != 0 &&
               scopes.Any(s => WriteScopes.Contains(s, StringComparer.OrdinalIgnoreCase));
    }

    /// <summary>True when the request is authenticated via a PAT (not JWT/hub ticket).</summary>
    public static bool IsPatRequest(ClaimsPrincipal user) =>
        user.Identities.Any(i =>
            i.IsAuthenticated && i.AuthenticationType == PatAuthenticationHandler.SchemeName);
}
