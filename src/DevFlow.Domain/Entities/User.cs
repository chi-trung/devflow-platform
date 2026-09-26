using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class User : BaseEntity, IAuditableEntity
{
    private User()
    {
    }

    private User(string email, string username, string passwordHash, string displayName)
    {
        Email = email;
        Username = username;
        PasswordHash = passwordHash;
        DisplayName = displayName;
    }

    public string Email { get; private set; } = string.Empty;

    public string Username { get; private set; } = string.Empty;

    public string PasswordHash { get; private set; } = string.Empty;

    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>
    /// Provider-hosted picture URL (Google <c>picture</c> / GitHub
    /// <c>avatar_url</c>). Null for password users and for OAuth users whose
    /// provider never returned one — the UI falls back to initials.
    /// </summary>
    public string? AvatarUrl { get; private set; }

    /// <summary>
    /// When the address in <see cref="Email"/> was proven to belong to this
    /// user, or null while it is still unproven. Accounts that predate email
    /// verification are backfilled to "now" by the migration that added this
    /// column, so they are never locked out.
    /// </summary>
    public DateTimeOffset? EmailVerifiedAtUtc { get; private set; }

    /// <summary>
    /// When the last verification link was generated. Used to space resends out
    /// so one person (or a script) cannot fill someone's inbox with mail.
    /// </summary>
    public DateTimeOffset? EmailVerificationSentAtUtc { get; private set; }

    /// <summary>
    /// When the last password reset link was generated. Throttle only — the
    /// tokens themselves live in the <c>password_reset_tokens</c> table.
    /// </summary>
    public DateTimeOffset? PasswordResetSentAtUtc { get; private set; }

    /// <summary>
    /// An unverified account may not hold a session. Every token-issuing path
    /// (login, refresh, OAuth exchange) checks this, so an unverified user
    /// never has a token in the first place.
    /// </summary>
    public bool IsEmailVerified => EmailVerifiedAtUtc is not null;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static User Create(string email, string username, string passwordHash, string displayName)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            throw new ArgumentException("Username is required.", nameof(username));
        }

        if (string.IsNullOrWhiteSpace(passwordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(passwordHash));
        }

        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Display name is required.", nameof(displayName));
        }

        return new User(email.Trim().ToLowerInvariant(), username.Trim(), passwordHash, displayName.Trim());
    }

    public void UpdateProfile(string displayName, string username)
    {
        if (string.IsNullOrWhiteSpace(displayName))
        {
            throw new ArgumentException("Display name is required.", nameof(displayName));
        }

        if (string.IsNullOrWhiteSpace(username))
        {
            throw new ArgumentException("Username is required.", nameof(username));
        }

        DisplayName = displayName.Trim();
        Username = username.Trim();
    }

    public void UpdatePasswordHash(string newPasswordHash)
    {
        if (string.IsNullOrWhiteSpace(newPasswordHash))
        {
            throw new ArgumentException("Password hash is required.", nameof(newPasswordHash));
        }

        PasswordHash = newPasswordHash;
    }

    /// <summary>
    /// Marks the address as proven. Idempotent: a repeat call (an old
    /// verification link clicked twice) keeps the FIRST timestamp, so the
    /// recorded proof date stays truthful.
    /// </summary>
    public void MarkEmailVerified()
    {
        EmailVerifiedAtUtc ??= DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Records that a verification link was just generated. Returns false and
    /// changes nothing when one went out less than
    /// <paramref name="cooldown"/> ago, so the caller can quietly skip the send.
    /// </summary>
    public bool TryRecordVerificationSent(TimeSpan cooldown, DateTimeOffset? nowUtc = null)
    {
        var now = nowUtc ?? DateTimeOffset.UtcNow;

        if (EmailVerificationSentAtUtc is not null && now - EmailVerificationSentAtUtc.Value < cooldown)
        {
            return false;
        }

        EmailVerificationSentAtUtc = now;
        return true;
    }

    /// <summary>
    /// Records that a password reset link was just generated. Same cooldown
    /// idea as <see cref="TryRecordVerificationSent"/> but separate, because
    /// the two senders must not steal each other's throttle: a user waiting on
    /// a reset link and then asking for a verification link should get both,
    /// not be told to wait a minute for one that was never sent.
    /// </summary>
    public bool TryRecordPasswordResetSent(TimeSpan cooldown, DateTimeOffset? nowUtc = null)
    {
        var now = nowUtc ?? DateTimeOffset.UtcNow;

        if (PasswordResetSentAtUtc is not null && now - PasswordResetSentAtUtc.Value < cooldown)
        {
            return false;
        }

        PasswordResetSentAtUtc = now;
        return true;
    }

    /// <summary>
    /// Stores the provider avatar URL, clamped to the column's 500-char limit.
    /// Callers pass the identity's picture on every OAuth sign-in; an absent
    /// picture (e.g. locked Google profile) passes null and never clears a URL
    /// we already have — the handler only calls this when a URL was returned.
    /// </summary>
    public void UpdateAvatarUrl(string? avatarUrl)
    {
        if (string.IsNullOrWhiteSpace(avatarUrl))
        {
            AvatarUrl = null;
            return;
        }

        var trimmed = avatarUrl.Trim();
        AvatarUrl = trimmed.Length > 500 ? trimmed[..500] : trimmed;
    }
}
