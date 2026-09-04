using DevFlow.Api.Auth;
using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace DevFlow.UnitTests.Features.Pat;

/// <summary>
/// The scope gate: a read-only PAT must get 403 on state-changing methods,
/// a write-scoped PAT must pass, and JWT requests must never be restricted.
/// </summary>
public class PatScopeMiddlewareTests
{
    private static HttpContext BuildContext(string method, ClaimsPrincipal? user)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.User = user ?? new ClaimsPrincipal(new ClaimsIdentity()); // anonymous
        return context;
    }

    private static ClaimsPrincipal PatPrincipal(params string[] scopes)
    {
        var claims = scopes.Select(s => new Claim(PatAuthenticationHandler.ScopesClaim, s)).ToList();
        claims.Add(new Claim("sub", Guid.NewGuid().ToString()));
        return new ClaimsPrincipal(new ClaimsIdentity(claims, PatAuthenticationHandler.SchemeName));
    }

    private static ClaimsPrincipal JwtPrincipal() =>
        new(new ClaimsIdentity(new[] { new Claim("sub", Guid.NewGuid().ToString()) }, "Bearer"));

    private static async Task<int> Invoke(HttpContext context)
    {
        var middleware = new PatScopeMiddleware(_ =>
        {
            context.Response.StatusCode = StatusCodes.Status200OK;
            return Task.CompletedTask;
        });
        await middleware.InvokeAsync(context);
        return context.Response.StatusCode;
    }

    [Theory]
    [InlineData("POST")]
    [InlineData("PUT")]
    [InlineData("PATCH")]
    [InlineData("DELETE")]
    public async Task ReadOnlyPat_ShouldGet403_OnUnsafeMethods(string method)
    {
        var context = BuildContext(method, PatPrincipal("read"));
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status403Forbidden, status);
    }

    [Theory]
    [InlineData("GET")]
    [InlineData("HEAD")]
    [InlineData("OPTIONS")]
    public async Task ReadOnlyPat_ShouldPass_OnSafeMethods(string method)
    {
        var context = BuildContext(method, PatPrincipal("read"));
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Fact]
    public async Task WriteScopedPat_ShouldPass_OnUnsafeMethods()
    {
        var context = BuildContext("DELETE", PatPrincipal("read", "write"));
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Theory]
    [InlineData("tasks")]
    [InlineData("admin")]
    public async Task OtherWriteScopes_ShouldPass_OnUnsafeMethods(string scope)
    {
        var context = BuildContext("POST", PatPrincipal(scope));
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Fact]
    public async Task ScopeComparison_ShouldBeCaseInsensitive()
    {
        // Tokens minted elsewhere might carry "WRITE" — treat as write.
        var context = BuildContext("POST", PatPrincipal("WRITE"));
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Fact]
    public async Task JwtRequest_ShouldNeverBeRestricted()
    {
        // The web app authenticates via JWT which carries no df_scopes claim;
        // scope enforcement must apply to PATs only.
        var context = BuildContext("DELETE", JwtPrincipal());
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Fact]
    public async Task AnonymousRequest_ShouldPassThrough()
    {
        // Anonymous requests are [Authorize]'s business, not the scope gate's.
        var context = BuildContext("DELETE", null);
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status200OK, status);
    }

    [Fact]
    public async Task PatWithNoScopesClaim_ShouldGet403_OnUnsafeMethods()
    {
        // A PAT identity without a scopes claim cannot prove write intent.
        var principal = new ClaimsPrincipal(
            new ClaimsIdentity(new[] { new Claim("sub", Guid.NewGuid().ToString()) },
                PatAuthenticationHandler.SchemeName));
        var context = BuildContext("POST", principal);
        var status = await Invoke(context);
        Assert.Equal(StatusCodes.Status403Forbidden, status);
    }
}
