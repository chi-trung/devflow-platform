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
    // Only the workspace fan-out lives here. A NotifyUser/NotifyProject pair
    // used to sit on this interface with zero callers, a stale { type, data }
    // payload, and — for projects — a "project:{id}" group that no client
    // ever joins (the frontend's project-event listeners connect to
    // ProjectHub's "project-{id}" group instead). Any future caller wiring
    // through them would have broadcast into the void; user/project events
    // go through SignalRNotificationService / SignalRProjectNotifier, which
    // match the live client contracts.
    Task NotifyWorkspace(string workspaceId, string type, object data);
}

public sealed class NotificationBroadcaster(IHubContext<NotificationHub> hubContext) : INotificationBroadcaster
{
    public async Task NotifyWorkspace(string workspaceId, string type, object data)
    {
        // useWorkspaceEvents reads top-level eventType/workspaceId — emit
        // those names (matching the project-event writer in
        // SignalRProjectNotifier), not the generic { type, data } shape,
        // which left the hook's declared payload permanently null.
        await hubContext.Clients.Group($"workspace:{workspaceId}")
            .SendAsync("workspace-event", new { eventType = type, workspaceId, data });
    }
}
