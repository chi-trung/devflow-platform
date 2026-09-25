using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

/// <summary>
/// A single-use credential for <c>POST /auth/forgot-password</c> → reset link.
///
/// This is a DATABASE row rather than a self-contained JWT like the email
/// verification link is, and the difference is the whole reason. A password
/// reset has to be one-shot: whoever holds the link can set a new password, and
/// a token that stayed valid for a day would be a standing key to the account —
/// sitting in a mail archive, a mail-server log, or a forwarding rule. The
/// verification link does not have that problem (it only ever sets a boolean),
/// so a stateless token was enough there and is not enough here.
///
/// Single-use is enforced by the row: <see cref="IsActive"/> goes false the
/// moment it is consumed, and issuing a new link revokes the previous one.
/// Revoking on issue is what stops "request a reset, let the mail arrive late,
/// then click the older link" from working — after a new request, only the newest
/// link is live.
///
/// The link itself is a random 48-byte string, not a JWT: it must not be
/// forgeable, and a JWT would be replayable (see above).
/// </summary>
public class PasswordResetToken : BaseEntity, IAuditableEntity
{
    private PasswordResetToken()
    {
    }

    private PasswordResetToken(
        Guid userId,
        string tokenHash,
        DateTimeOffset expiresAtUtc)
    {
        UserId = userId;
        TokenHash = tokenHash;
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid UserId { get; private set; }

    /// <summary>
    /// SHA-256 hex of the emailed string, never the string itself. A database
    /// dump (a leaked backup, a replica, a `SELECT *` in a support ticket) must
    /// not hand the attacker working reset links; the same reasoning as
    /// <c>PersonalAccessToken.TokenHash</c>.
    /// </summary>
    public string TokenHash { get; private set; } = string.Empty;

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public DateTimeOffset? UsedAtUtc { get; private set; }

    public DateTimeOffset? RevokedAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAtUtc;

    public bool IsActive => !IsExpired && UsedAtUtc is null && RevokedAtUtc is null;

    public static PasswordResetToken Create(
        Guid userId,
        string tokenHash,
        DateTimeOffset expiresAtUtc)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        if (string.IsNullOrWhiteSpace(tokenHash))
        {
            throw new ArgumentException("Token hash is required.", nameof(tokenHash));
        }

        if (expiresAtUtc <= DateTimeOffset.UtcNow)
        {
            throw new ArgumentException("Expiration must be in the future.", nameof(expiresAtUtc));
        }

        return new PasswordResetToken(userId, tokenHash.Trim().ToLowerInvariant(), expiresAtUtc);
    }

    /// <summary>
    /// Burns the token. Idempotent by design: a double submit (an impatient
    /// double-click, or a link pre-fetched by a mail scanner) must report the
    /// same failure as a token that was already used, not a confusing success.
    /// </summary>
    public void MarkUsed(DateTimeOffset usedAtUtc)
    {
        UsedAtUtc ??= usedAtUtc;
    }

    public void Revoke(DateTimeOffset revokedAtUtc)
    {
        RevokedAtUtc ??= revokedAtUtc;
    }
}
