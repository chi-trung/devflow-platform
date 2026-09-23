using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface IWorkspaceInvitationRepository
{
    Task AddAsync(WorkspaceInvitation invitation, CancellationToken cancellationToken = default);

    Task<WorkspaceInvitation?> GetPendingAsync(
        Guid workspaceId,
        Guid invitedUserId,
        CancellationToken cancellationToken = default);

    Task<WorkspaceInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WorkspaceInvitation>> ListPendingForWorkspaceAsync(
        Guid workspaceId,
        CancellationToken cancellationToken = default);

    Task<IReadOnlyList<WorkspaceInvitation>> ListPendingForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default);

    Task<bool> HasPendingForUserInWorkspaceAsync(
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken = default);
}
