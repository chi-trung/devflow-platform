using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IUserRepository
{
    Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<bool> ExistsByUsernameAsync(string username, CancellationToken cancellationToken = default);

    Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);

    Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(User user, CancellationToken cancellationToken = default);

    /// <summary>
    /// Stages the removal of every row that still names this account but is
    /// NOT covered by a cascade foreign key — workspace and project
    /// memberships, invitations on either end, notifications sent to or sent
    /// by it, and the tasks assigned to it (those are unassigned rather than
    /// deleted, since the task belongs to the project, not to the person).
    ///
    /// Staged, not executed: nothing here runs until the caller flushes the
    /// unit of work, so a failure part-way through cannot leave memberships
    /// gone while the account itself is still there. History the person
    /// authored — comments, activity rows, plans and knowledge they created —
    /// is deliberately left alone; see the repository for why.
    ///
    /// Returns the workspace ids whose member roster just changed, so the
    /// caller can drop the cached rosters after the flush. They cannot be
    /// re-read afterwards: by then the rows are staged for deletion.
    /// </summary>
    Task<IReadOnlyList<Guid>> RemoveAccountReferencesAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    /// <summary>Stages the removal of the account row itself.</summary>
    Task RemoveAsync(User user, CancellationToken cancellationToken = default);

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
