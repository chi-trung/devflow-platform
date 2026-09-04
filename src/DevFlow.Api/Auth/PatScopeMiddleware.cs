using Microsoft.AspNetCore.Http;

namespace DevFlow.Api.Auth;

/// <summary>
/// Enforces PAT scopes: a personal access token whose scopes are read-only
/// may call GET/HEAD/OPTIONS but receives 403 on state-changing methods.
/// Runs after UseAuthentication, before UseAuthorization, so the PAT
/// principal (with its df_scopes claim) is available and endpoint routing
/// has not short-circuited anything yet.
/// </summary>
public sealed class PatScopeMiddleware(RequestDelegate next)
{
    private static readonly HashSet<string> UnsafeMethods = new(StringComparer.OrdinalIgnoreCase)
    { "POST", "PUT", "PATCH", "DELETE" };

    public async Task InvokeAsync(HttpContext context)
    {
        var user = context.User;
        if (user?.Identity?.IsAuthenticated == true &&
            PatScopes.IsPatRequest(user) &&
            UnsafeMethods.Contains(context.Request.Method) &&
            !PatScopes.CanWrite(user))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.4",
                title = "Insufficient scope",
                status = 403,
                detail = "This personal access token is read-only; write operations require a write scope.",
            });
            return;
        }

        await next(context);
    }
}
