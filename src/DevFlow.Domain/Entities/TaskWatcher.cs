using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class TaskWatcher : BaseEntity
{
    private TaskWatcher()
    {
    }

    private TaskWatcher(Guid taskItemId, Guid userId)
    {
        TaskItemId = taskItemId;
        UserId = userId;
        CreatedAtUtc = DateTimeOffset.UtcNow;
    }

    public Guid TaskItemId { get; private set; }

    public Guid UserId { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; private set; }

    public static TaskWatcher Create(Guid taskItemId, Guid userId)
    {
        if (taskItemId == Guid.Empty)
        {
            throw new ArgumentException("Task id is required.", nameof(taskItemId));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        return new TaskWatcher(taskItemId, userId);
    }
}
