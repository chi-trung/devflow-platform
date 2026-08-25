using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface IProjectMemberRepository
{
    Task<IReadOnlyList<ProjectMember>> GetByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    /// <summary>Fetches the project members for a user across all projects in a workspace.</summary>
    Task<IReadOnlyList<ProjectMember>> GetByUserInWorkspaceAsync(Guid workspaceId, Guid userId, CancellationToken cancellationToken = default);

    Task<ProjectMember?> GetAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);

    Task<bool> ExistsAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);

    Task<ProjectRole?> GetRoleAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);

    Task AddAsync(ProjectMember member, CancellationToken cancellationToken = default);

    Task RemoveAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default);
}
