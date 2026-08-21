using DevFlow.Domain.Entities;

namespace DevFlow.UnitTests.DomainTests;

public class ActivityLogTests
{
    [Fact]
    public void Create_ShouldInstantiateActivityLog_WithValidParams()
    {
        var wsId = Guid.NewGuid();
        var projId = Guid.NewGuid();
        var taskId = Guid.NewGuid();
        var actorId = Guid.NewGuid();

        var log = ActivityLog.Create(wsId, projId, taskId, actorId, "created task", "Task Title");

        Assert.Equal(wsId, log.WorkspaceId);
        Assert.Equal(projId, log.ProjectId);
        Assert.Equal(taskId, log.TaskItemId);
        Assert.Equal(actorId, log.ActorUserId);
        Assert.Equal("created task", log.Action);
        Assert.Equal("Task Title", log.Target);
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_ShouldThrow_WhenActionIsMissing(string action)
    {
        Assert.Throws<ArgumentException>(() =>
            ActivityLog.Create(Guid.NewGuid(), Guid.NewGuid(), null, Guid.NewGuid(), action, "target"));
    }
}
