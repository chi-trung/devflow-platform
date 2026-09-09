using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ISocialLoginRepository
{
    Task<SocialLogin?> GetByProviderAsync(
        string provider,
        string subject,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Looks up the user's link with an identity provider by our user id —
    /// used to fetch the stored GitHub access token for repo operations.
    /// </summary>
    Task<SocialLogin?> GetByUserAndProviderAsync(
        Guid userId,
        string provider,
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