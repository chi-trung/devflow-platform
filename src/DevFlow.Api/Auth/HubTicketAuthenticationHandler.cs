using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace DevFlow.Api.Auth;

/// <summary>
/// Authenticates hub connections presenting a one-time ticket (from
/// HubTicketStore) instead of a JWT. The SignalR client can only ever put
/// the credential in <c>access_token</c> (WebSocket query string) or the
/// <c>Authorization: Bearer</c> header (negotiate POST / long polling), so
/// tickets are recognized by their <c>hbt_</c> prefix in either place and
/// claims are rebuilt from the user id the ticket was issued for — the same
/// inbound "sub" shape the JWT carries, so UserContext, hubs and rate
/// limiting see the identical principal.
/// </summary>
public sealed class HubTicketAuthenticationHandler(
    HubTicketStore store,
    IOptionsMonitor<HubTicketAuthenticationOptions> options,
    ILoggerFactory logger,
    UrlEncoder encoder)
    : AuthenticationHandler<HubTicketAuthenticationOptions>(options, logger, encoder)
{
    public const string SchemeName = "HubTicket";
    public const string QueryParameter = "access_token";

    /// <summary>True when the request presents a hub ticket (not a JWT).</summary>
    public static bool PresentsTicket(HttpContext context)
    {
        var queryToken = context.Request.Query[QueryParameter];
        if (queryToken.Count > 0 && queryToken.ToString().StartsWith(HubTicketStore.Prefix, StringComparison.Ordinal))
            return true;

        var authHeader = context.Request.Headers.Authorization.ToString();
        return authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) &&
               authHeader["Bearer ".Length..].TrimStart().StartsWith(HubTicketStore.Prefix, StringComparison.Ordinal);
    }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        // JWT credentials belong to the bearer scheme; only handle tickets.
        var ticket = Context.Request.Query[QueryParameter];
        var authHeader = Context.Request.Headers.Authorization.ToString();
        var headerToken = authHeader.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase)
            ? authHeader["Bearer ".Length..].TrimStart()
            : null;

        var presented =
            ticket.Count > 0 ? ticket.ToString() : headerToken;

        if (string.IsNullOrEmpty(presented))
            return Task.FromResult(AuthenticateResult.NoResult());

        if (!presented.StartsWith(HubTicketStore.Prefix, StringComparison.Ordinal))
            return Task.FromResult(AuthenticateResult.NoResult());

        var userId = store.Redeem(presented);
        if (userId is null)
        {
            return Task.FromResult(AuthenticateResult.Fail(
                "Hub ticket is invalid, expired, or already used."));
        }

        // Mirror the JWT's inbound claim shape (MapInboundClaims=false):
        // UserContext and SubUserIdProvider both read "sub".
        var claims = new[]
        {
            new Claim("sub", userId),
            new Claim("jti", Guid.NewGuid().ToString()),
        };
        var identity = new ClaimsIdentity(claims, SchemeName);
        var principal = new ClaimsPrincipal(identity);

        return Task.FromResult(AuthenticateResult.Success(
            new AuthenticationTicket(principal, SchemeName)));
    }
}

/// <summary>Marker options for HubTicketAuthenticationHandler.</summary>
public sealed class HubTicketAuthenticationOptions : AuthenticationSchemeOptions;
