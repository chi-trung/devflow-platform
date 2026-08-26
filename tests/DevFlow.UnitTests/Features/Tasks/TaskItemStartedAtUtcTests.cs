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

        task.ChangeStatus(TaskItemStatus.Review);
        task.ChangeStatus(TaskItemStatus.InProgress);

        Assert.Equal(firstStarted, task.StartedAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldNotSetStartedAtUtc_WhenEnteringOtherStatuses()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.Review);
        task.ChangeStatus(TaskItemStatus.Done);

        Assert.Null(task.StartedAtUtc);
        Assert.NotNull(task.CompletedAtUtc);
    }

    [Fact]
    public void ChangeStatus_SevenStageFlow_ShouldStampTimestampsAtTheRightPoints()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        // Early pipeline stages never start the clock nor stamp completion.
        task.ChangeStatus(TaskItemStatus.Idea);
        task.ChangeStatus(TaskItemStatus.Planning);
        task.ChangeStatus(TaskItemStatus.Approval);
        task.ChangeStatus(TaskItemStatus.Ready);

        Assert.Null(task.StartedAtUtc);
        Assert.Null(task.CompletedAtUtc);

        // Ready → InProgress starts the clock.
        task.ChangeStatus(TaskItemStatus.InProgress);
        Assert.NotNull(task.StartedAtUtc);
        Assert.Null(task.CompletedAtUtc);

        // InProgress → Review keeps the clock, still not done.
        task.ChangeStatus(TaskItemStatus.Review);
        Assert.NotNull(task.StartedAtUtc);
        Assert.Null(task.CompletedAtUtc);

        // Review → Done stamps completion.
        task.ChangeStatus(TaskItemStatus.Done);
        Assert.NotNull(task.StartedAtUtc);
        Assert.NotNull(task.CompletedAtUtc);

        // Re-opening from Done clears the completion stamp but keeps the clock.
        task.ChangeStatus(TaskItemStatus.Review);
        Assert.NotNull(task.StartedAtUtc);
        Assert.Null(task.CompletedAtUtc);
    }
}
