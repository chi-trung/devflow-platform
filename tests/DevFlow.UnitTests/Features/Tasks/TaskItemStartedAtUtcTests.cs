using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.UnitTests.Features.Tasks;

public class TaskItemStartedAtUtcTests
{
    [Fact]
    public void ChangeStatus_ShouldSetStartedAtUtc_WhenEnteringInProgress()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.InProgress);

        Assert.NotNull(task.StartedAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldNotOverwriteStartedAtUtc_WhenReenteringInProgress()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.InProgress);
        var firstStarted = task.StartedAtUtc;

        task.ChangeStatus(TaskItemStatus.InReview);
        task.ChangeStatus(TaskItemStatus.InProgress);

        Assert.Equal(firstStarted, task.StartedAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldNotSetStartedAtUtc_WhenEnteringOtherStatuses()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.InReview);
        task.ChangeStatus(TaskItemStatus.Done);

        Assert.Null(task.StartedAtUtc);
        Assert.NotNull(task.CompletedAtUtc);
    }
}
