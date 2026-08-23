using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class PersonalAccessToken : BaseEntity, IAuditableEntity
{
    private PersonalAccessToken()
    {
    }

    private PersonalAccessToken(
        Guid userId,
        string name,
        string tokenHash,
        IReadOnlyList<string> scopes,
        DateTimeOffset expiresAtUtc)
    {
        UserId = userId;
        Name = name;
        TokenHash = tokenHash;
        Scopes = scopes.ToArray();
        ExpiresAtUtc = expiresAtUtc;
    }

    public Guid UserId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string TokenHash { get; private set; } = string.Empty;

    public string[] Scopes { get; private set; } = [];

    public DateTimeOffset ExpiresAtUtc { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? LastUsedAtUtc { get; private set; }

    public DateTimeOffset? RevokedAtUtc { get; private set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public bool IsExpired => DateTimeOffset.UtcNow >= ExpiresAtUtc;

    public bool IsActive => !IsExpired && RevokedAtUtc is null;

    public static PersonalAccessToken Create(
        Guid userId,
        string name,
        string tokenHash,
        IReadOnlyList<string> scopes,
        DateTimeOffset? expiresAtUtc)
    {
        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(tokenHash))
        {
            throw new ArgumentException("Token hash is required.", nameof(tokenHash));
        }

        var validScopes = scopes
            .Where(scope => !string.IsNullOrWhiteSpace(scope))
            .Select(scope => scope.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();

        if (validScopes.Length == 0)
        {
            throw new ArgumentException("At least one scope is required.", nameof(scopes));
        }

        var expiration = expiresAtUtc ?? DateTimeOffset.UtcNow.AddDays(30);

        if (expiration <= DateTimeOffset.UtcNow)
        {
            throw new ArgumentException("Expiration must be in the future.", nameof(expiresAtUtc));
        }

        return new PersonalAccessToken(userId, name.Trim(), tokenHash, validScopes, expiration);
    }

    public void Revoke(DateTimeOffset revokedAtUtc)
    {
        RevokedAtUtc = revokedAtUtc;
    }

    public void MarkUsed(DateTimeOffset usedAtUtc)
    {
        LastUsedAtUtc = usedAtUtc;
    }
}
