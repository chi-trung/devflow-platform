using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class PasswordResetTokenRepository(
    DevFlowDbContext dbContext) : IPasswordResetTokenRepository
{
    public async Task AddAsync(PasswordResetToken token, CancellationToken cancellationToken = default)
    {
        await dbContext.PasswordResetTokens.AddAsync(token, cancellationToken);
    }

    public Task<PasswordResetToken?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken = default)
    {
        return dbContext.PasswordResetTokens
            .FirstOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);
    }

    public async Task<IReadOnlyList<PasswordResetToken>> GetActiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Expired rows are excluded in SQL rather than filtered in memory:
        // the caller revokes what it gets, and an expired row is already dead
        // so there is nothing to gain by loading it.
        var now = DateTimeOffset.UtcNow;

        return await dbContext.PasswordResetTokens
            .Where(token =>
                token.UserId == userId
                && token.UsedAtUtc == null
                && token.RevokedAtUtc == null
                && token.ExpiresAtUtc > now)
            .OrderByDescending(token => token.CreatedAtUtc)
            .ToListAsync(cancellationToken);
    }
}
