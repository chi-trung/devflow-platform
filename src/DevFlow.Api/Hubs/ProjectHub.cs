using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;

namespace DevFlow.Api.Hubs;

[Authorize]
public sealed class ProjectHub : Hub
{
    private const string ProjectIdItemKey = "projectId";

    public async Task JoinProject(Guid projectId)
    {
        var userId = Context.UserIdentifier ?? "";
        var payload = GetUserPayload(userId);

        await Groups.AddToGroupAsync(Context.ConnectionId, GroupName(projectId));
        Context.Items[ProjectIdItemKey] = projectId;

        await Clients.OthersInGroup(GroupName(projectId)).SendAsync("user-joined", payload);
    }

    public async Task LeaveProject(Guid projectId)
    {
        var userId = Context.UserIdentifier ?? "";

        await Clients.OthersInGroup(GroupName(projectId)).SendAsync("user-left", new { userId });

        await Groups.RemoveFromGroupAsync(Context.ConnectionId, GroupName(projectId));

        if (Context.Items.TryGetValue(ProjectIdItemKey, out var stored) &&
            stored is Guid storedProjectId && storedProjectId == projectId)
        {
            Context.Items.Remove(ProjectIdItemKey);
        }
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (Context.Items.TryGetValue(ProjectIdItemKey, out var stored) &&
            stored is Guid projectId)
        {
            var userId = Context.UserIdentifier ?? "";
            await Clients.OthersInGroup(GroupName(projectId)).SendAsync("user-left", new { userId });
        }

        await base.OnDisconnectedAsync(exception);
    }

    public static string GroupName(Guid projectId) => $"project-{projectId}";

    private object GetUserPayload(string userId)
    {
        var username = Context.User?.FindFirstValue(ClaimTypes.Name)
            ?? Context.User?.FindFirstValue("username")
            ?? "";
        var displayName = Context.User?.FindFirstValue("displayName")
            ?? Context.User?.FindFirstValue(ClaimTypes.GivenName);

        return new { userId, username, displayName };
    }
}
