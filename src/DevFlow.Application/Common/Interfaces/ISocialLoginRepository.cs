using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ISocialLoginRepository
{
    Task<SocialLogin?> GetByProviderAsync(
        string provider,
        string subject,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsForUserAsync(
        Guid userId,
        string provider,
        CancellationToken cancellationToken = default);

    Task AddAsync(SocialLogin login, CancellationToken cancellationToken = default);

    Task RemoveByProviderAsync(
        Guid userId,
        string provider,
        CancellationToken cancellationToken = default);
}