using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class SocialLoginRepository(DevFlowDbContext dbContext) : ISocialLoginRepository
{
    public Task<SocialLogin?> GetByProviderAsync(
        string provider,
        string subject,
        CancellationToken cancellationToken = default)
    {
        return dbContext.SocialLogins
            .FirstOrDefaultAsync(
                login => login.Provider == provider && login.Subject == subject,
                cancellationToken);
    }

    public Task<bool> ExistsForUserAsync(
        Guid userId,
        string provider,
        CancellationToken cancellationToken = default)
    {
        return dbContext.SocialLogins
            .AnyAsync(
                login => login.UserId == userId && login.Provider == provider,
                cancellationToken);
    }

    public async Task AddAsync(SocialLogin login, CancellationToken cancellationToken = default)
    {
        await dbContext.SocialLogins.AddAsync(login, cancellationToken);
    }

    public async Task RemoveByProviderAsync(
        Guid userId,
        string provider,
        CancellationToken cancellationToken = default)
    {
        var login = await dbContext.SocialLogins
            .FirstOrDefaultAsync(
                item => item.UserId == userId && item.Provider == provider,
                cancellationToken);

        if (login is not null)
        {
            dbContext.SocialLogins.Remove(login);
        }
    }
}