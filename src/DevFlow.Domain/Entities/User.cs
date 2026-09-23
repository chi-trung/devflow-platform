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
