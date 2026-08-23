using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IPersonalAccessTokenRepository
{
    Task<IReadOnlyList<PersonalAccessToken>> GetActiveByUserIdAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<PersonalAccessToken?> GetByTokenHashAsync(
        string tokenHash,
        CancellationToken cancellationToken = default);

    Task AddAsync(PersonalAccessToken token, CancellationToken cancellationToken = default);

    Task RevokeAsync(Guid id, CancellationToken cancellationToken = default);

    Task TouchLastUsedAsync(Guid id, CancellationToken cancellationToken = default);
}
