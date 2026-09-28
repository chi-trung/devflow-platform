using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(DevFlowDbContext dbContext) : IUserRepository
{
    public Task<bool> ExistsByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.AnyAsync(user => user.Email == email, cancellationToken);
    }

    public Task<bool> ExistsByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.AnyAsync(user => user.Username == username, cancellationToken);
    }

    public Task<User?> GetByEmailAsync(string email, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.FirstOrDefaultAsync(user => user.Email == email, cancellationToken);
    }

    public Task<User?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.FirstOrDefaultAsync(user => user.Id == id, cancellationToken);
    }

    public async Task AddAsync(User user, CancellationToken cancellationToken = default)
    {
        await dbContext.Users.AddAsync(user, cancellationToken);
    }

    public async Task<IReadOnlyList<Guid>> RemoveAccountReferencesAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // Everything below is STAGED, never executed on the spot: the caller
        // flushes once, and EF wraps that flush in a single transaction. Running
        // these as bulk SQL instead would commit the moment they execute, so a
        // later failure could strip a person of their workspaces while leaving
        // the account that owned them untouched.
        //
        // Eight other tables pointing at users (refresh tokens, time entries,
        // notification preferences, saved searches, personal access tokens,
        // social logins, password reset tokens, task watchers) carry a cascade
        // FK and take care of themselves. These do not — none of them has an
        // FK to users at all — which is why they are enumerated by hand.

        var memberships = await dbContext.WorkspaceMembers
            .Where(member => member.UserId == userId)
            .ToListAsync(cancellationToken);
        dbContext.WorkspaceMembers.RemoveRange(memberships);

        var projectMemberships = await dbContext.ProjectMembers
            .Where(member => member.UserId == userId)
            .ToListAsync(cancellationToken);
        dbContext.ProjectMembers.RemoveRange(projectMemberships);

        // Both ends. An invitation this account received and one it sent are
        // equally useless once the person is gone, and leaving either behind
        // would offer an invite to or from somebody who no longer exists.
        var invitations = await dbContext.WorkspaceInvitations
            .Where(invitation =>
                invitation.InvitedUserId == userId ||
                invitation.InvitedByUserId == userId)
            .ToListAsync(cancellationToken);
        dbContext.WorkspaceInvitations.RemoveRange(invitations);

        var notifications = await dbContext.Notifications
            .Where(notification =>
                notification.UserId == userId ||
                notification.ActorUserId == userId)
            .ToListAsync(cancellationToken);
        dbContext.Notifications.RemoveRange(notifications);

        // Unassign rather than delete: the task is the project's, not this
        // person's, and dropping it would silently delete other people's work.
        //
        // IgnoreQueryFilters is required, not an optimisation: TaskItem carries a
        // global DeletedAtUtc == null filter, so a plain query would skip every
        // soft-deleted task and leave it assigned to an id that no longer exists.
        var assigned = await dbContext.TaskItems
            .IgnoreQueryFilters()
            .Where(task => task.AssigneeId == userId)
            .ToListAsync(cancellationToken);
        foreach (var task in assigned)
        {
            task.AssignTo(null);
        }

        // Read while the rows still answer. The caller needs these ids to drop
        // the cached member rosters after the flush, and by then the rows above
        // are staged for deletion and would read back as nothing.
        var touchedWorkspaceIds = memberships
            .Select(member => member.WorkspaceId)
            .Distinct()
            .ToList();

        // Deliberately NOT touched: comments.author_id, activity_logs.actor_user_id,
        // ai_plans.created_by, knowledge_entries.created_by and
        // recurring_task_rules.created_by_user_id. Those are attribution for
        // history the person made inside shared workspaces, and every reader
        // already degrades on a missing name — activity renders as "Someone"
        // (ListActivitiesQueryHandler) or "Unknown" (DashboardController), and a
        // comment shows a short id slice. Deleting them instead would erase
        // conversations and the workspace's audit trail.

        return touchedWorkspaceIds;
    }

    public Task RemoveAsync(User user, CancellationToken cancellationToken = default)
    {
        dbContext.Users.Remove(user);
        return Task.CompletedTask;
    }

    public async Task<IReadOnlyDictionary<Guid, string>> GetDisplayNamesAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        var ids = userIds.ToList();

        var names = await dbContext.Users
            .AsNoTracking()
            .Where(user => ids.Contains(user.Id))
            .Select(user => new { user.Id, user.DisplayName })
            .ToDictionaryAsync(entry => entry.Id, entry => entry.DisplayName, cancellationToken);

        return names;
    }

    public async Task<IReadOnlyDictionary<Guid, User>> GetByIdsAsync(
        IEnumerable<Guid> userIds,
        CancellationToken cancellationToken = default)
    {
        var ids = userIds.ToList();

        var users = await dbContext.Users
            .AsNoTracking()
            .Where(user => ids.Contains(user.Id))
            .ToListAsync(cancellationToken);

        return users.ToDictionary(user => user.Id);
    }

    public Task<bool> ExistsByUsernameExceptIdAsync(string username, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.AnyAsync(user => user.Username == username && user.Id != userId, cancellationToken);
    }

    public Task<User?> GetByUsernameAsync(string username, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.FirstOrDefaultAsync(user => user.Username == username, cancellationToken);
    }

    public Task<bool> ExistsByEmailExceptIdAsync(string email, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.Users.AnyAsync(
            user => user.Email == email && user.Id != userId,
            cancellationToken);
    }

    public async Task<IReadOnlyList<string>> GetLinkedProvidersAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        // AsNoTracking: this is a read-only status endpoint, and the banner
        // refetches it after every link attempt.
        return await dbContext.SocialLogins
            .AsNoTracking()
            .Where(login => login.UserId == userId)
            .Select(login => login.Provider)
            .ToListAsync(cancellationToken);
    }
}
