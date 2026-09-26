using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IPasswordResetTokenRepository
{
    Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Resolves a hashed token to its row. Tracked, not <c>AsNoTracking</c> —
    /// the reset handler burns the row (and the user's sessions) in the same
    /// unit of work.
    /// </summary>
    Task<PasswordResetToken?> GetByTokenHashAsync(string tokenHash, CancellationToken cancellationToken = default);

    /// <summary>
    /// Live tokens for a user, newest first. Used to revoke the previous links
    /// when a new one is issued.
    /// </summary>
    Task<IReadOnlyList<PasswordResetToken>> GetActiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default);
}
