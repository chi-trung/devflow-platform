using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;

namespace DevFlow.UnitTests.Features.Tasks;

public class TaskItemEnteredReviewAtUtcTests
{
    [Fact]
    public void ChangeStatus_ShouldStampEnteredReviewAtUtc_WhenEnteringReview()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.InProgress);
        Assert.Null(task.EnteredReviewAtUtc);

        task.ChangeStatus(TaskItemStatus.Review);

        Assert.NotNull(task.EnteredReviewAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldKeepEnteredReviewAtUtc_WhenReappliedWithSameStatus()
    {
        // Reorder calls ChangeStatus on every drag, including drops that keep
        // the card in the Review column — the age must not reset.
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);
        task.ChangeStatus(TaskItemStatus.Review);
        var entered = task.EnteredReviewAtUtc;

        task.ChangeStatus(TaskItemStatus.Review);

        Assert.Equal(entered, task.EnteredReviewAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldRefreshEnteredReviewAtUtc_OnReEntry()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);
        task.ChangeStatus(TaskItemStatus.Review);
        var first = task.EnteredReviewAtUtc;

        task.ChangeStatus(TaskItemStatus.InProgress);
        // UtcNow can repeat within a tight loop; guarantee a measurable gap.
        SpinWait.SpinUntil(() => DateTimeOffset.UtcNow > first!.Value, TimeSpan.FromSeconds(1));
        task.ChangeStatus(TaskItemStatus.Review);

        Assert.NotNull(task.EnteredReviewAtUtc);
        Assert.True(task.EnteredReviewAtUtc > first);

        // Leaving Review keeps the last stamp — the board only ages Review cards.
        var afterReEntry = task.EnteredReviewAtUtc;
        task.ChangeStatus(TaskItemStatus.Done);
        Assert.Equal(afterReEntry, task.EnteredReviewAtUtc);
    }

    [Fact]
    public void ChangeStatus_ShouldNeverStampEnteredReviewAtUtc_WhenReviewSkipped()
    {
        var task = TaskItem.Create(Guid.NewGuid(), "A", null, TaskItemPriority.Medium);

        task.ChangeStatus(TaskItemStatus.Done);

        Assert.Null(task.EnteredReviewAtUtc);
    }
}
