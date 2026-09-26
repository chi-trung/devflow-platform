using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class RefreshTokenRepository(DevFlowDbContext dbContext) : IRefreshTokenRepository
{
    public async Task AddAsync(RefreshToken refreshToken, CancellationToken cancellationToken = default)
    {
        await dbContext.RefreshTokens.AddAsync(refreshToken, cancellationToken);
    }

    public Task<RefreshToken?> GetByTokenAsync(string token, CancellationToken cancellationToken = default)
    {
        return dbContext.RefreshTokens
            .FirstOrDefaultAsync(refreshToken => refreshToken.Token == token, cancellationToken);
    }

    public async Task<int> RevokeAllForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // IsActive and IsExpired are computed in C# (they call DateTimeOffset.UtcNow
        // and are not translatable), so the "still alive" filter is expressed in
        // the query instead. The expiry comparison lives in SQL on purpose:
        // DateTimeOffset.UtcNow is evaluated by the database, so every row in
        // this batch is judged against the same instant.
        var now = DateTimeOffset.UtcNow;

        var tokens = await dbContext.RefreshTokens
            .Where(refreshToken =>
                refreshToken.UserId == userId
                && refreshToken.RevokedAtUtc == null
                && refreshToken.ExpiresAtUtc > now)
            .ToListAsync(cancellationToken);

        foreach (var token in tokens)
        {
            token.Revoke(now);
        }

        return tokens.Count;
    }
}
