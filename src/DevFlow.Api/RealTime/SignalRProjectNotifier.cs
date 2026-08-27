using DevFlow.Api.Hubs;
using DevFlow.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.RealTime;

/// <summary>
/// Real-time fan-out for project and workspace changes. Project events go out
/// on the ProjectHub group; workspace events reuse the notification hub's
/// existing <c>workspace:{id}</c> group (clients join it via JoinWorkspace).
/// </summary>
public sealed class SignalRProjectNotifier(
    IHubContext<ProjectHub> hubContext,
    INotificationBroadcaster notificationBroadcaster)
    : IRealtimeNotifier
{
    public Task NotifyProjectAsync(
        Guid projectId,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        return hubContext.Clients
            .Group(ProjectHub.GroupName(projectId))
            .SendAsync("project-event", new { eventType }, cancellationToken);
    }

    public Task NotifyWorkspaceAsync(
        Guid workspaceId,
        string eventType,
        CancellationToken cancellationToken = default)
    {
        return notificationBroadcaster.NotifyWorkspace(
            workspaceId.ToString(),
            eventType,
            new { eventType });
    }
}
