using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface IWorkspaceRepository
{
    Task<bool> ExistsBySlugAsync(string slug, CancellationToken cancellationToken = default);

    Task<Workspace?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<(Workspace Workspace, WorkspaceRole Role)>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<(Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)>>
        GetMembersAsync(Guid workspaceId, CancellationToken cancellationToken = default);

    Task<WorkspaceRole?> GetMemberRoleAsync(Guid workspaceId, Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(Workspace workspace, CancellationToken cancellationToken = default);

    Task AddMemberAsync(Workspace workspace, Guid userId, WorkspaceRole role, CancellationToken cancellationToken = default);

    Task RemoveMemberAsync(Guid workspaceId, Guid userId, CancellationToken cancellationToken = default);

    Task UpdateMemberRoleAsync(Guid workspaceId, Guid userId, WorkspaceRole newRole, CancellationToken cancellationToken = default);

    void Delete(Workspace workspace);
}
