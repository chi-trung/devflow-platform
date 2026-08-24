using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

/// <summary>
/// Links a user account to an external identity provider (e.g. Google) so
/// they can sign in without a password. One user may have many social logins.
/// </summary>
public class SocialLogin : BaseEntity, IAuditableEntity
{
    private SocialLogin()
    {
    }

    private SocialLogin(Guid userId, string provider, string subject)
    {
        UserId = userId;
        Provider = provider;
        Subject = subject;
    }

    public Guid UserId { get; private set; }

    /// <summary>Identity provider key, e.g. "google".</summary>
    public string Provider { get; private set; } = string.Empty;

    /// <summary>Provider's stable identifier for the person (Google "sub").</summary>
    public string Subject { get; private set; } = string.Empty;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static SocialLogin Create(Guid userId, string provider, string subject)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        if (string.IsNullOrWhiteSpace(provider))
        {
            throw new ArgumentException("Provider is required.", nameof(provider));
        }

        if (string.IsNullOrWhiteSpace(subject))
        {
            throw new ArgumentException("Subject is required.", nameof(subject));
        }

        return new SocialLogin(userId, provider.Trim().ToLowerInvariant(), subject.Trim());
    }
}
