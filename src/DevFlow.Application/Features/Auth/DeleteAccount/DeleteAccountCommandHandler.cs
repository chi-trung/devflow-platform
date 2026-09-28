using DevFlow.Application.Common.Interfaces;
using MediatR;

namespace DevFlow.Application.Features.Auth.DeleteAccount;

public sealed class DeleteAccountCommandHandler(
    IUserRepository userRepository,
    ICacheService cacheService,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteAccountCommand>
{
    public async Task Handle(DeleteAccountCommand command, CancellationToken cancellationToken)
    {
        var user = await userRepository.GetByIdAsync(command.UserId, cancellationToken);

        // Idempotent on purpose. The access token is a JWT that outlives the row
        // it names by up to 15 minutes, so a second DELETE — a double-click, or a
        // retry after a flaky response — arrives with a token that still
        // authenticates but no account to act on. Answering 404 there would make
        // an already-successful deletion look like a failure.
        if (user is null)
        {
            return;
        }

        // Both stages are staged against the same DbContext. The workspace ids
        // come back with the memberships while those rows are still readable;
        // they are needed below, after the flush.
        var touchedWorkspaceIds = await userRepository.RemoveAccountReferencesAsync(
            command.UserId, cancellationToken);
        await userRepository.RemoveAsync(user, cancellationToken);

        // One flush, therefore one transaction: the orphan cleanup, the account
        // row and the eight cascade children (refresh tokens, time entries,
        // notification preferences, saved searches, personal access tokens,
        // social logins, password reset tokens, task watchers) commit or roll
        // back together. Nothing here revokes refresh tokens explicitly — the
        // cascade already kills them with the account.
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Strictly post-commit. Dropping the rosters before the flush would
        // repopulate them from a database that still lists the person, and
        // dropping them after a failed flush would contradict a row that is
        // still there. Until this runs the deleted member can linger in an
        // assignee picker for the cache's 2-minute TTL.
        foreach (var workspaceId in touchedWorkspaceIds)
        {
            await cacheService.RemoveAsync($"workspace-members:{workspaceId}", cancellationToken);
        }
    }
}
