using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface IProjectRepository
{
    Task<bool> KeyExistsInWorkspaceAsync(Guid workspaceId, string key, CancellationToken cancellationToken = default);

    Task<Project?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task AddAsync(Project project, CancellationToken cancellationToken = default);
}
