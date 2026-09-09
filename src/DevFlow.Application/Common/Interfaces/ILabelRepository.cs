using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ILabelRepository
{
    Task AddAsync(Label label, CancellationToken cancellationToken = default);

    Task<Label?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Label>> GetForProjectAsync(Guid projectId, CancellationToken cancellationToken = default);

    Task RemoveAsync(Label label, CancellationToken cancellationToken = default);

    Task<bool> ExistsByNameInProjectAsync(Guid projectId, string name, CancellationToken cancellationToken = default);

    // Task-Label assignments
    Task AddTaskLabelAsync(TaskLabel taskLabel, CancellationToken cancellationToken = default);

    Task RemoveTaskLabelAsync(Guid taskItemId, Guid labelId, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Label>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Batch for the board's task list: task id → label ids, for the given
    /// page of tasks in one project-wide query. Labels are filtered by
    /// ProjectId so a task shared across projects can't leak another
    /// project's label into the cached payload.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, IReadOnlyList<Guid>>> GetLabelIdsByTaskIdsAsync(
        Guid projectId,
        IReadOnlyCollection<Guid> taskIds,
        CancellationToken cancellationToken = default);

    Task<bool> TaskHasLabelAsync(Guid taskItemId, Guid labelId, CancellationToken cancellationToken = default);
}
