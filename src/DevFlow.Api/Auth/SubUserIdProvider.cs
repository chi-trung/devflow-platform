using System.IdentityModel.Tokens.Jwt;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.Auth;

/// <summary>
/// SignalR's DefaultUserIdProvider reads the "nameidentifier" claim, which
/// never exists on DevFlow JWTs (MapInboundClaims=false keeps "sub"). Without
/// this, Context.UserIdentifier is null — presence payloads and the
/// per-user notification group "user:{id}" silently never match anyone.
/// </summary>
public sealed class SubUserIdProvider : IUserIdProvider
{
    public string? GetUserId(HubConnectionContext connection) =>
        connection.User?.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
}
