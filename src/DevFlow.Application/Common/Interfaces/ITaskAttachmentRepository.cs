using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskAttachmentRepository
{
    Task AddAsync(TaskAttachment attachment, CancellationToken cancellationToken = default);

    Task<TaskAttachment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskAttachment>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    Task RemoveAsync(TaskAttachment attachment, CancellationToken cancellationToken = default);
}
