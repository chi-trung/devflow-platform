using System.IdentityModel.Tokens.Jwt;
using DevFlow.Domain.Entities;
using DevFlow.Infrastructure.Authentication;
using Microsoft.Extensions.Options;

namespace DevFlow.UnitTests.Authentication;

public class JwtTokenProviderAvatarTests
{
    private static JwtTokenProvider CreateProvider()
    {
        // The signing key must be >= 256 bits for HmacSha256.
        var settings = new JwtSettings
        {
            Issuer = "devflow-tests",
            Audience = "devflow-tests",
            Key = new string('k', 64),
            AccessTokenExpiryMinutes = 15,
        };
        return new JwtTokenProvider(Options.Create(settings));
    }

    private static JwtSecurityToken ReadToken(string token)
    {
        var handler = new JwtSecurityTokenHandler();
        // Read without validating signature — these tests only inspect claims.
        handler.ValidateToken(
            token,
            new Microsoft.IdentityModel.Tokens.TokenValidationParameters
            {
                ValidateIssuer = false,
                ValidateAudience = false,
                ValidateLifetime = false,
                ValidateIssuerSigningKey = false,
                SignatureValidator = (_, _) => handler.ReadJwtToken(token),
            },
            out _);
        return handler.ReadJwtToken(token);
    }

    [Fact]
    public void GenerateAccessToken_IncludesAvatarUrl_WhenUserHasOne()
    {
        var user = User.Create("avatar@test.dev", "avatar", "hash", "Avatar");
        user.UpdateAvatarUrl("https://lh3.googleusercontent.com/pic");

        var claims = ReadToken(CreateProvider().GenerateAccessToken(user)).Claims;

        Assert.Equal(
            "https://lh3.googleusercontent.com/pic",
            claims.Single(c => c.Type == "avatarUrl").Value);
    }

    [Fact]
    public void GenerateAccessToken_OmitsAvatarUrlClaim_WhenUserHasNone()
    {
        // Password users have no avatar — the claim must be absent entirely,
        // not the string "null", so the frontend falls back to initials.
        var user = User.Create("plain@test.dev", "plain", "hash", "Plain");

        var claims = ReadToken(CreateProvider().GenerateAccessToken(user)).Claims;

        Assert.DoesNotContain(claims, c => c.Type == "avatarUrl");
    }
}
