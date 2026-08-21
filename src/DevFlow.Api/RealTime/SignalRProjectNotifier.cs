using DevFlow.Api.Hubs;
using DevFlow.Application.Common.Interfaces;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.RealTime;

public sealed class SignalRProjectNotifier(IHubContext<ProjectHub> hubContext)
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
}
