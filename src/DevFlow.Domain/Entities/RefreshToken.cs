using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class RefreshToken : BaseEntity, IAuditableEntity
{
    private RefreshToken()
    {
    }

    private RefreshToken(Guid userId, string token, DateTimeOffset expiresAtUtc)
    {
        UserId = userId;
        Token = token;
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid UserId { get; private set; }

    public string Token { get; private set; } = string.Empty;

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public DateTimeOffset? RevokedAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAtUtc;

    public bool IsActive => !IsExpired && RevokedAtUtc is null;

    public void Revoke(DateTimeOffset revokedAtUtc)
    {
        RevokedAtUtc = revokedAtUtc;
    }

    public static RefreshToken Create(Guid userId, string token, DateTimeOffset expiresAtUtc)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        if (string.IsNullOrWhiteSpace(token))
        {
            throw new ArgumentException("Token is required.", nameof(token));
        }

        if (expiresAtUtc <= DateTimeOffset.UtcNow)
        {
            throw new ArgumentException("Expiration must be in the future.", nameof(expiresAtUtc));
        }

        return new RefreshToken(userId, token, expiresAtUtc);
    }
}
