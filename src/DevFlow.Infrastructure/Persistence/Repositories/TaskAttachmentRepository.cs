using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class TaskAttachmentRepository(DevFlowDbContext dbContext) : ITaskAttachmentRepository
{
    public async Task AddAsync(TaskAttachment attachment, CancellationToken cancellationToken = default)
    {
        await dbContext.TaskAttachments.AddAsync(attachment, cancellationToken);
    }

    public Task<TaskAttachment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.TaskAttachments.FirstOrDefaultAsync(attachment => attachment.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<TaskAttachment>> GetForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default)
    {
        var attachments = await dbContext.TaskAttachments
            .AsNoTracking()
            .Where(attachment => attachment.TaskItemId == taskItemId)
            .OrderByDescending(attachment => attachment.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return attachments;
    }

    public async Task<(IReadOnlyList<TaskAttachment> Items, int TotalCount)> GetForTaskPagedAsync(
        Guid taskItemId,
        int skip,
        int take,
        CancellationToken cancellationToken = default)
    {
        var query = dbContext.TaskAttachments
            .AsNoTracking()
            .Where(attachment => attachment.TaskItemId == taskItemId);

        var totalCount = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(attachment => attachment.CreatedAtUtc)
            .Skip(skip)
            .Take(take)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task<int> DeleteAttachmentsForTaskAsync(Guid taskItemId, CancellationToken cancellationToken = default)
    {
        var attachments = await dbContext.TaskAttachments
            .Where(attachment => attachment.TaskItemId == taskItemId)
            .ToListAsync(cancellationToken);

        dbContext.TaskAttachments.RemoveRange(attachments);
        return attachments.Count;
    }

    public async Task RemoveAsync(TaskAttachment attachment, CancellationToken cancellationToken = default)
    {
        dbContext.TaskAttachments.Remove(attachment);
        await Task.CompletedTask;
    }
}
