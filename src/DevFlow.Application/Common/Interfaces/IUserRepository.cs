using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IUserRepository
{
    Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<bool> ExistsByUsernameAsync(string username, CancellationToken cancellationToken = default);

    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, string>> GetDisplayNamesAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyDictionary<Guid, User>> GetByIdsAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default);

    Task<bool> ExistsByUsernameExceptIdAsync(string username, Guid userId, CancellationToken cancellationToken = default);

    Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default);

    /// <summary>
    /// Whether some OTHER account already holds this address. Needed when a
    /// linked provider hands one out: the address is about to be attached to
    /// this account, and the unique index would reject the write at flush time
    /// with an opaque 500. <paramref name="userId"/> is excluded so re-attaching
    /// an address the account already holds is not a false positive.
    /// </summary>
    Task<bool> ExistsByEmailExceptIdAsync(string email, Guid userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Every provider this account has linked, e.g. ["google"]. Drives the
    /// dashboard prompt that asks an account with no recovery route to link one.
    /// </summary>
    Task<IReadOnlyList<string>> GetLinkedProvidersAsync(Guid userId, CancellationToken cancellationToken = default);
}
