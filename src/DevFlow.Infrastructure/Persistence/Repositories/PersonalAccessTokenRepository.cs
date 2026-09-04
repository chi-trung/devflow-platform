using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class PersonalAccessTokenRepository(
    DevFlowDbContext dbContext) : IPersonalAccessTokenRepository
{
    public async Task<IReadOnlyList<PersonalAccessToken>> GetActiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var tokens = await dbContext.PersonalAccessTokens
            .AsNoTracking()
            .Where(token => token.UserId == userId && token.RevokedAtUtc == null)
            .OrderByDescending(token => token.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return tokens;
    }

    public Task<PersonalAccessToken?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken = default)
    {
        return dbContext.PersonalAccessTokens
            .FirstOrDefaultAsync(token => token.TokenHash == tokenHash, cancellationToken);
    }

    public async Task AddAsync(
        PersonalAccessToken token,
        CancellationToken cancellationToken = default)
    {
        await dbContext.PersonalAccessTokens.AddAsync(token, cancellationToken);
    }

    public async Task RevokeAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var token = await dbContext.PersonalAccessTokens
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (token is not null)
        {
            token.Revoke(DateTimeOffset.UtcNow);
        }
    }

    public async Task TouchLastUsedAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var token = await dbContext.PersonalAccessTokens
            .FirstOrDefaultAsync(t => t.Id == id, cancellationToken);

        if (token is not null)
        {
            token.MarkUsed(DateTimeOffset.UtcNow);
            // Persisted here (not by the caller) so the auth handler can stamp
            // usage without enlisting the request's unit of work.
            await dbContext.SaveChangesAsync(cancellationToken);
        }
    }
}
