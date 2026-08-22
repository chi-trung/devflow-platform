using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

/// <summary>
/// Represents a dependency between two tasks.
/// BlockedTaskId is blocked by BlockerTaskId.
/// </summary>
public class TaskDependency : BaseEntity
{
    private TaskDependency()
    {
    }

    private TaskDependency(Guid blockedTaskId, Guid blockerTaskId)
    {
        BlockedTaskId = blockedTaskId;
        BlockerTaskId = blockerTaskId;
    }

    public Guid BlockedTaskId { get; private set; }

    public Guid BlockerTaskId { get; private set; }

    public static TaskDependency Create(Guid blockedTaskId, Guid blockerTaskId)
    {
        if (blockedTaskId == blockerTaskId)
            throw new ArgumentException("A task cannot block itself.");

        return new TaskDependency(blockedTaskId, blockerTaskId);
    }
}
