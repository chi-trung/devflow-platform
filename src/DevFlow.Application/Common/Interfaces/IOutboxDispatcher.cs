namespace DevFlow.Application.Common.Interfaces;

public interface IOutboxDispatcher
{
    Task EnqueueAsync(string type, object payload, CancellationToken cancellationToken = default);
}
