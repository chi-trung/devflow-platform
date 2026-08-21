using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class CommentRepository(DevFlowDbContext dbContext) : ICommentRepository
{
    public async Task AddAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        await dbContext.Comments.AddAsync(comment, cancellationToken);
    }

    public Task<Comment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Comments.FirstOrDefaultAsync(comment => comment.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<Comment>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default)
    {
        var comments = await dbContext.Comments
            .AsNoTracking()
            .Where(comment => comment.TaskItemId == taskItemId)
            .OrderBy(comment => comment.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return comments;
    }

    public async Task RemoveAsync(Comment comment, CancellationToken cancellationToken = default)
    {
        dbContext.Comments.Remove(comment);
        await Task.CompletedTask;
    }
}
