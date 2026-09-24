using DevFlow.Domain.Entities;

namespace DevFlow.UnitTests.DomainTests;

public class OutboxMessageWorkspaceScopeTests
{
    [Fact]
    public void ResolveWorkspaceId_WebhookPayload_ReturnsId()
    {
        var id = Guid.NewGuid();
        var payload = $"{{\"workspaceId\":\"{id}\",\"eventName\":\"task.updated\",\"data\":{{}}}}";

        Assert.Equal(id, OutboxMessage.ResolveWorkspaceId("webhook.task.updated", payload));
    }

    [Fact]
    public void ResolveWorkspaceId_KnowledgeReembed_ReturnsId()
    {
        var workspaceId = Guid.NewGuid();
        var entryId = Guid.NewGuid();
        var projectId = Guid.NewGuid();
        var payload =
            $"{{\"workspaceId\":\"{workspaceId}\",\"knowledgeEntryId\":\"{entryId}\",\"projectId\":\"{projectId}\"}}";

        Assert.Equal(
            workspaceId,
            OutboxMessage.ResolveWorkspaceId("knowledge.reembed", payload));
    }

    [Fact]
    public void ResolveWorkspaceId_KnowledgePayload_CaseInsensitiveFallback()
    {
        var workspaceId = Guid.NewGuid();
        var payload = $"{{\"WorkspaceId\":\"{workspaceId}\"}}";

        Assert.Equal(
            workspaceId,
            OutboxMessage.ResolveWorkspaceId("knowledge.reembed", payload));
    }

    [Fact]
    public void ResolveWorkspaceId_NonScopedType_ReturnsNull()
    {
        Assert.Null(OutboxMessage.ResolveWorkspaceId("something.else", "{}"));
    }

    [Fact]
    public void ResolveWorkspaceId_CorruptPayload_ReturnsNull()
    {
        Assert.Null(OutboxMessage.ResolveWorkspaceId("knowledge.reembed", "not-json"));
    }
}
