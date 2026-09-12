using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.Hubs;

[Authorize]
public sealed class NotificationHub : Hub
{
    public async Task JoinWorkspace(string workspaceId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"workspace:{workspaceId}");
    }

    public async Task LeaveWorkspace(string workspaceId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"workspace:{workspaceId}");
    }

    public async Task JoinProject(string projectId)
    {
        await Groups.AddToGroupAsync(Context.ConnectionId, $"project:{projectId}");
    }

    public async Task LeaveProject(string projectId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"project:{projectId}");
    }

    public override async Task OnConnectedAsync()
    {
        var userId = Context.UserIdentifier;
        if (!string.IsNullOrEmpty(userId))
        {
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user:{userId}");
        }
        await base.OnConnectedAsync();
    }
}

public interface INotificationBroadcaster
{
    Task NotifyUser(string userId, string type, object data);
    Task NotifyWorkspace(string workspaceId, string type, object data);
    Task NotifyProject(string projectId, string type, object data);
}

public sealed class NotificationBroadcaster(IHubContext<NotificationHub> hubContext) : INotificationBroadcaster
{
    public async Task NotifyUser(string userId, string type, object data)
    {
        await hubContext.Clients.Group($"user:{userId}")
            .SendAsync("notification", new { type, data });
    }

    public async Task NotifyWorkspace(string workspaceId, string type, object data)
    {
        // useWorkspaceEvents reads top-level eventType/workspaceId — emit
        // those names (matching the project-event writer in
        // SignalRProjectNotifier), not the generic { type, data } shape,
        // which left the hook's declared payload permanently null.
        await hubContext.Clients.Group($"workspace:{workspaceId}")
            .SendAsync("workspace-event", new { eventType = type, workspaceId, data });
    }

    public async Task NotifyProject(string projectId, string type, object data)
    {
        await hubContext.Clients.Group($"project:{projectId}")
            .SendAsync("project-event", new { type, data });
    }
}
