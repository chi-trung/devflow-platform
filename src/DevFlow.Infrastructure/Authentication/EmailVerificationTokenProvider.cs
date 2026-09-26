using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace DevFlow.Infrastructure.Authentication;

/// <summary>
/// Issues verification links as JWTs signed with the same key as session
/// tokens, but carrying a different AUDIENCE and a distinct claim type.
///
/// That audience is the whole security design. The bearer pipeline in
/// Program.cs validates audience against <c>Jwt:Audience</c>, so a
/// verification token presented as an <c>Authorization: Bearer</c> header is
/// rejected there — the two token kinds are separated by validation the app
/// already performs, with no extra table and no extra lookup. It also means
/// the validation direction is safe: a session token hitting
/// <see cref="Validate"/> fails the audience check, so pasting an access token
/// into the verify link cannot verify anything.
///
/// A token is NOT single-use. Verification is idempotent (a second click is a
/// no-op) and the token carries no state the database would have to track, so
/// a leaked old link stays harmless once the address is verified.
/// </summary>
public sealed class EmailVerificationTokenProvider(IOptions<JwtSettings> options) : IEmailVerificationTokenProvider
{
    /// <summary>Audience for verification links — deliberately not the session audience.</summary>
    private const string VerificationAudience = "devflow-email-verify";

    /// <summary>24 hours: long enough to survive a weekend, short enough that a
    /// leaked inbox screenshot is not a standing key.</summary>
    private static readonly TimeSpan TokenLifetime = TimeSpan.FromHours(24);

    private const string TokenTypeClaim = "type";
    private const string EmailVerificationTokenType = "email_verify";

    private readonly JwtSettings _settings = options.Value;

    public string Generate(Guid userId)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, userId.ToString()),
            new(TokenTypeClaim, EmailVerificationTokenType),
        };

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: VerificationAudience,
            claims: claims,
            expires: DateTime.UtcNow.Add(TokenLifetime),
            signingCredentials: SigningCredentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public Guid? Validate(string? token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return null;
        }

        try
        {
            var handler = new JwtSecurityTokenHandler
            {
                // Required, not cosmetic. Left at its default of true, the
                // handler rewrites the "sub" claim to the long
                // ClaimTypes.NameIdentifier URI on the way in, so looking the
                // subject up by JwtRegisteredClaimNames.Sub below finds nothing
                // and every freshly minted link reads as invalid. The bearer
                // pipeline in Program.cs sets this for the same reason.
                MapInboundClaims = false,
            };

            var principal = handler.ValidateToken(
                token,
                new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidIssuer = _settings.Issuer,
                    ValidateAudience = true,
                    ValidAudience = VerificationAudience,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    IssuerSigningKey = SigningKey,
                    ClockSkew = TimeSpan.Zero,
                },
                out _);

            // Belt and braces: even with issuer+audience+signature checked, make
            // sure this really is a verification token and not some other kind
            // of JWT that happens to share the key.
            var isVerificationToken = principal.Claims.Any(claim =>
                claim.Type == TokenTypeClaim && claim.Value == EmailVerificationTokenType);

            if (!isVerificationToken)
            {
                return null;
            }

            var subject = principal.FindFirst(JwtRegisteredClaimNames.Sub)?.Value;
            return Guid.TryParse(subject, out var userId) && userId != Guid.Empty
                ? userId
                : null;
        }
        catch (Exception exception) when (exception is SecurityTokenException
                                          or ArgumentException
                                          or FormatException)
        {
            // Expired, tampered, truncated, or not a JWT at all. All of them
            // mean the same thing to the caller: no user id.
            return null;
        }
    }

    private SymmetricSecurityKey SigningKey => new(Encoding.UTF8.GetBytes(_settings.Key));

    private SigningCredentials SigningCredentials =>
        new(SigningKey, SecurityAlgorithms.HmacSha256);
}
