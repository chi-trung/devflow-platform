namespace DevFlow.Application.Common.Interfaces;

/// <summary>
/// Pushes a realtime notification to a single user via SignalR.
/// The frontend <c>useNotifications</c> hook listens for the "notification"
/// event with shape { type, data: { message, taskId, projectId, workspaceId } }.
/// </summary>
public interface IRealtimeNotificationService
{
    Task NotifyUserAsync(
        Guid userId,
        string type,
        string message,
        Guid? taskId,
        Guid? projectId,
        Guid? workspaceId,
        CancellationToken cancellationToken = default);
}
