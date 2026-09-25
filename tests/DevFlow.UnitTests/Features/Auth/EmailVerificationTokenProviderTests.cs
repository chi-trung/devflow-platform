using System.IdentityModel.Tokens.Jwt;
using System.Text;
using DevFlow.Infrastructure.Authentication;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DevFlow.UnitTests.Features.Auth;

/// <summary>
/// The verification link is the only credential an unverified account has, so
/// a round-trip that silently returns null would lock every new user out with
/// a message telling them the link expired. This pins the round trip, and in
/// particular the claim mapping: <see cref="JwtSecurityTokenHandler"/> rewrites
/// "sub" to a long URI claim by default, which is why the bearer pipeline in
/// Program.cs sets MapInboundClaims = false. This provider has to do the same.
/// </summary>
public class EmailVerificationTokenProviderTests
{
    private const string Key = "SuperSecretTestKeyWithSufficientLength1234567890";

    private static EmailVerificationTokenProvider CreateProvider() =>
        new(Options.Create(new JwtSettings
        {
            Key = Key,
            Issuer = "devflow-api",
            Audience = "devflow-client",
        }));

    [Fact]
    public void GenerateThenValidate_ShouldReturnSameUserId()
    {
        var provider = CreateProvider();
        var userId = Guid.NewGuid();

        var userIdFromToken = provider.Validate(provider.Generate(userId));

        Assert.Equal(userId, userIdFromToken);
    }

    [Fact]
    public void Validate_ShouldReject_WhenTokenIsSignedWithAnotherKey()
    {
        var attacker = new EmailVerificationTokenProvider(Options.Create(new JwtSettings
        {
            Key = "ACompletelyDifferentKeyWithSufficientLength0987654321",
            Issuer = "devflow-api",
            Audience = "devflow-client",
        }));

        var forged = attacker.Generate(Guid.NewGuid());

        Assert.Null(CreateProvider().Validate(forged));
    }

    /// <summary>
    /// The direction that matters most: a real access token, which is a valid
    /// signature over the same key and issuer, must not verify an address.
    /// Audience separation is what stops a leaked session token from doubling
    /// as a verification link.
    /// </summary>
    [Fact]
    public void Validate_ShouldReject_WhenGivenASessionToken()
    {
        var accessToken = new JwtSecurityToken(
            issuer: "devflow-api",
            audience: "devflow-client",
            claims: [new System.Security.Claims.Claim(JwtRegisteredClaimNames.Sub, Guid.NewGuid().ToString())],
            expires: DateTime.UtcNow.AddMinutes(15),
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(Key)),
                SecurityAlgorithms.HmacSha256));

        var raw = new JwtSecurityTokenHandler().WriteToken(accessToken);

        Assert.Null(CreateProvider().Validate(raw));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("not-a-jwt")]
    public void Validate_ShouldReturnNull_ForUnusableInput(string? token)
    {
        Assert.Null(CreateProvider().Validate(token));
    }
}
