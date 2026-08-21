using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using DevFlow.Application.Common.Interfaces;

namespace DevFlow.Api.Auth;

public sealed class UserContext(IHttpContextAccessor httpContextAccessor) : IUserContext
{
    public Guid UserId
    {
        get
        {
            var claim = httpContextAccessor.HttpContext?.User.FindFirstValue(JwtRegisteredClaimNames.Sub);

            return Guid.TryParse(claim, out var userId)
                ? userId
                : throw new UnauthorizedAccessException("User is not authenticated.");
        }
    }
}
