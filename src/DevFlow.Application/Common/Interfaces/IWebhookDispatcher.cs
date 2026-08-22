namespace DevFlow.Application.Common.Interfaces;

public interface IWebhookDispatcher
{
    Task DispatchAsync(Guid workspaceId, string eventName, object payload, CancellationToken cancellationToken = default);
}
