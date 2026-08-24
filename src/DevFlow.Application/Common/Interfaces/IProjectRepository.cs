using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface IProjectRepository
{
    Task<bool> KeyExistsInWorkspaceAsync(Guid workspaceId, string key, CancellationToken cancellationToken = default);

    Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    /// <summary>Fetches a project regardless of soft-delete state (bypasses the DeletedAtUtc query filter).</summary>
    Task<Project?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Project>> GetForWorkspaceAsync(Guid workspaceId, CancellationToken cancellationToken = default);

    Task AddAsync(Project project, CancellationToken cancellationToken = default);
}
