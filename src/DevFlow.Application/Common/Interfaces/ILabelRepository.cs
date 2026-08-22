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

    Task<bool> TaskHasLabelAsync(Guid taskItemId, Guid labelId, CancellationToken cancellationToken = default);
}
