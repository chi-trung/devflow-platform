namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Broadcasts realtime change events to clients connected to a project.
/// </summary>
public interface IRealtimeNotifier
{
    Task NotifyProjectAsync(
        Guid projectId,
        string eventType,
        CancellationToken cancellationToken = default);
}
