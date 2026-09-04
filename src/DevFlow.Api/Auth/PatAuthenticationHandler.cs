using DevFlow.Application.Common.Interfaces;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace DevFlow.Api.Auth;

/// <summary>
/// Authenticates API requests presenting a personal access token
/// (<c>Authorization: Bearer df_...</c>) instead of a JWT. Tokens are hashed
/// (SHA-256 hex, same shape CreatePatCommandHandler stores) and looked up by
/// hash; only active tokens (not expired, not revoked) authenticate. Claims
/// mirror the JWT's inbound shape ("sub") so UserContext, rate limiting and
/// authorization see the identical principal, plus a "scopes" claim carrying
/// the token's scopes for endpoint-level checks.
/// </summary>
public sealed class PatAuthenticationHandler(
    IPersonalAccessTokenRepository patRepository,
    IOptionsMonitor<PatAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<PatAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = "Pat";
    public const string TokenPrefix = "df_";
    public const string ScopesClaim = "df_scopes";

    /// <summary>True when the request presents a personal access token (not a JWT or hub ticket).</summary>
    public static bool PresentsPat(HttpContext context)
    {
        var authHeader = context.Request.Headers.Authorization.ToString();
        return authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) &&
               authHeader["Bearer ".Length..].TrimStart().StartsWith(TokenPrefix, StringComparison.Ordinal);
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // JWT and hub-ticket credentials belong to their own schemes; only
        // handle personal access tokens.
        var authHeader = Context.Request.Headers.Authorization.ToString();
        if (!authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
            return AuthenticateResult.NoResult();

        var presented = authHeader["Bearer ".Length..].TrimStart();
        if (!presented.StartsWith(TokenPrefix, StringComparison.Ordinal))
            return AuthenticateResult.NoResult();

        var tokenHash = HashToken(presented);
        var token = await patRepository.GetByTokenHashAsync(tokenHash, Context.RequestAborted);
        if (token is null || !token.IsActive)
        {
            return AuthenticateResult.Fail(
                "Personal access token is invalid, expired, or revoked.");
        }

        var claims = new List<Claim>
        {
            new("sub", token.UserId.ToString()),
            new(ScopesClaim, string.Join(' ', token.Scopes)),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);

        // Fire-and-forget last-used stamp: a failure here must not fail the
        // request — the token already proved itself.
        try
        {
            await patRepository.TouchLastUsedAsync(token.Id, Context.RequestAborted);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "Failed to update last-used time for PAT {TokenId}", token.Id);
        }

        return AuthenticateResult.Success(new AuthenticationTicket(principal, SchemeName));
    }

    internal static string HashToken(string token)
    {
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var hash = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}

/// <summary>Marker options for PatAuthenticationHandler.</summary>
public sealed class PatAuthenticationOptions : AuthenticationSchemeOptions;
