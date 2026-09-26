using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IRefreshTokenRepository
{
    Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default);

    Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes every live session for a user, returning how many were killed.
    /// Called after a password reset: the person holding the link is proving
    /// control of the mailbox, and anyone who was signed in on a stolen device
    /// loses that access the moment the new password exists.
    /// </summary>
    Task<int> RevokeAllForUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
