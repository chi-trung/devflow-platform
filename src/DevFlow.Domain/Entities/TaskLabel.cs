using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class TaskLabel : BaseEntity
{
    private TaskLabel()
    {
    }

    private TaskLabel(Guid taskItemId, Guid labelId)
    {
        TaskItemId = taskItemId;
        LabelId = labelId;
    }

    public Guid TaskItemId { get; private set; }

    public Guid LabelId { get; private set; }

    public static TaskLabel Create(Guid taskItemId, Guid labelId)
    {
        return new TaskLabel(taskItemId, labelId);
    }
}
