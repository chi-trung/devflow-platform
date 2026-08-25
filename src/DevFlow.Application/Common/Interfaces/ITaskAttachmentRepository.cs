using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ITaskAttachmentRepository
{
    Task AddAsync(TaskAttachment attachment, CancellationToken cancellationToken = default);

    Task<TaskAttachment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<TaskAttachment>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    Task<(IReadOnlyList<TaskAttachment> Items, int TotalCount)> GetForTaskPagedAsync(
        Guid taskItemId,
        int skip,
        int take,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Batch-fetches attachment metadata for many task ids in a single grouped
    /// query (avoids N+1). Used to build card attachment summaries.
    /// </summary>
    Task<IReadOnlyDictionary<Guid, IReadOnlyList<TaskAttachment>>> GetByTaskIdsAsync(
        IEnumerable<Guid> taskItemIds,
        CancellationToken cancellationToken = default);

    Task<int> DeleteAttachmentsForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    Task RemoveAsync(TaskAttachment attachment, CancellationToken cancellationToken = default);
}
