using DevFlow.Api.Hubs;
using DevFlow.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.RealTime;

/// <summary>
/// Delivers realtime notifications to a single user's SignalR group
/// ("user:{userId}"). The frontend useNotifications hook listens for the
/// "notification" event on that group.
/// </summary>
public sealed class SignalRNotificationService(
    IHubContext<NotificationHub> hubContext) : IRealtimeNotificationService
{
    public Task NotifyUserAsync(
        Guid userId,
        string type,
        string message,
        Guid? taskId,
        Guid? projectId,
        Guid? workspaceId,
        CancellationToken cancellationToken = default)
    {
        return hubContext.Clients
            .Group($"user:{userId}")
            .SendAsync(
                "notification",
                new
                {
                    type,
                    data = new
                    {
                        message,
                        taskId = taskId?.ToString(),
                        projectId = projectId?.ToString(),
                        workspaceId = workspaceId?.ToString(),
                    },
                },
                cancellationToken);
    }
}
