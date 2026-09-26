using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class User : BaseEntity, IAuditableEntity
{
    private User()
    {
    }

    private User(string? email, string username, string passwordHash, string displayName)
    {
        Email = email;
        Username = username;
        PasswordHash = passwordHash;
        DisplayName = displayName;
    }

    /// <summary>
    /// The address an external provider proved this person owns, or null for a
    /// password account that has not linked a provider yet. Nullable because
    /// registration deliberately does not collect one: requiring an address to
    /// sign up let anyone claim an inbox that belonged to somebody else, and
    /// the only remedy was an emailed link — which needs a mail provider the
    /// free deployment tiers cannot run.
    /// </summary>
    public string? Email { get; private set; }

    /// <summary>
    /// The sign-in handle. This is the login identifier, since an account is not
    /// required to have an email to reach.
    /// </summary>
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
    /// user — by a provider that verified it, or by a link in an inbox.
    /// Null for a password account with no address at all, and for one whose
    /// address is still unproven.
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
    /// True once an address has been proven. Note this is no longer a gate on
    /// holding a session: registration does not collect an address, so an
    /// account without one is legitimate rather than pending.
    /// </summary>
    public bool IsEmailVerified => EmailVerifiedAtUtc is not null;

    /// <summary>
    /// Whether this account can still be recovered if its password is lost.
    /// Recovery is by emailed link, so an account with no proven address can
    /// only be re-entered through a linked provider — which is what the
    /// dashboard prompt asks for. Loss is permanent, so the UI must warn
    /// rather than quietly let it happen.
    /// </summary>
    public bool CanBeRecovered => Email is not null;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    /// <summary>
    /// Creates a password account with no email at all. This is what
    /// registration uses: the person gets in immediately and is prompted on the
    /// dashboard to link a Google or GitHub identity so the account can still be
    /// recovered if the password is lost.
    /// </summary>
    public static User CreateWithPassword(string username, string passwordHash, string displayName)
    {
        return Build(null, username, passwordHash, displayName);
    }

    /// <summary>
    /// Creates an account owned by an external identity provider. The provider
    /// has already proven the address, so it is stored as verified on the way
    /// in rather than marked afterwards.
    /// </summary>
    public static User CreateFromOAuth(string email, string username, string passwordHash, string displayName)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        var user = Build(email, username, passwordHash, displayName);
        user.EmailVerifiedAtUtc ??= DateTimeOffset.UtcNow;
        return user;
    }

    /// <summary>
    /// The email-collecting factory, kept for callers that already hold a
    /// provider-proven address. Registration does not use it — see
    /// <see cref="CreateWithPassword"/>.
    /// </summary>
    public static User Create(string email, string username, string passwordHash, string displayName)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        return Build(email, username, passwordHash, displayName);
    }

    private static User Build(string? email, string username, string passwordHash, string displayName)
    {
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

        return new User(
            string.IsNullOrWhiteSpace(email) ? null : email.Trim().ToLowerInvariant(),
            username.Trim(),
            passwordHash,
            displayName.Trim());
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
    /// Stores an address the person proved by linking an identity provider.
    /// Refuses one already held by somebody else: a provider asserting an
    /// address is the only evidence this has, and two accounts claiming the
    /// same inbox is exactly the collision the email column's unique index
    /// exists to prevent. Linking Google to a second account while the address
    /// is still someone's would otherwise silently take it over.
    /// </summary>
    public void AttachEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            throw new ArgumentException("Email is required.", nameof(email));
        }

        var normalized = email.Trim().ToLowerInvariant();

        if (Email is not null && !string.Equals(Email, normalized, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "This account already has a different email address.");
        }

        Email = normalized;
        // The provider just proved this address, so it is verified from here on
        // — no link in an inbox is involved, and none could arrive anyway.
        MarkEmailVerified();
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
