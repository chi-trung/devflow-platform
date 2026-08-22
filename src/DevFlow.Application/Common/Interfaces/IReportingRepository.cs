using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Interfaces;

public interface IReportingRepository
{
    Task<IReadOnlyList<TaskItem>> GetTasksByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Sprint>> GetSprintsByProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TimeEntry>> GetTimeEntriesByUserAsync(Guid userId, CancellationToken cancellationToken = default);
}
