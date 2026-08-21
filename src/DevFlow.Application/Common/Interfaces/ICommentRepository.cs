using DevFlow.Domain.Entities;

namespace DevFlow.Application.Common.Interfaces;

public interface ICommentRepository
{
    Task AddAsync(Comment comment, CancellationToken cancellationToken = default);

    Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);

    Task<IReadOnlyList<Comment>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default);

    Task RemoveAsync(Comment comment, CancellationToken cancellationToken = default);
}
