using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// There was no way to remove an account at all, which is how two throwaway
/// probe accounts ended up stranded on production with no route out.
///
/// The assertions that matter are the ones against the database rather than the
/// status codes: a 204 says nothing about whether the row went, and a failed
/// sign-in alone would not distinguish a real delete from a lockout. Every test
/// therefore reads the tables back.
/// </summary>
[Collection("IntegrationTests")]
public class DeleteAccountIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private const string Password = "Sup3rSecret!";

    private readonly HttpClient client = factory.CreateClient();

    private string username = null!;

    private void RequireRelationalDatabase()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        Assert.True(
            db.Database.IsRelational(),
            "Deleting an account has to satisfy real cascade FKs and real unique " +
            "indexes. The EF InMemory fallback that this factory silently drops " +
            "to enforces neither, so every assertion below would pass against the " +
            "very bug it exists to catch.");
    }

    [Fact]
    public async Task DeletingOwnAccount_ShouldReturn204AndRefuseTheCredentialsAfterwards()
    {
        RequireRelationalDatabase();

        var userId = await RegisterAndSignInAsync("Delete Me");
        Assert.True(await UserExistsAsync(userId));

        var delete = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        Assert.False(await UserExistsAsync(userId));

        // The username is free again, so the credentials that used to work
        // belong to nobody — which is what distinguishes a real delete from a
        // flag that only hides the account from one screen.
        var signIn = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username,
            password = Password,
        });

        Assert.Equal(HttpStatusCode.Unauthorized, signIn.StatusCode);
    }

    [Fact]
    public async Task DeletingOwnAccount_ShouldDropItsWorkspaceMembership()
    {
        RequireRelationalDatabase();

        var userId = await RegisterAndSignInAsync("Member Delete");
        await CreateWorkspaceAsync("Member Delete WS");

        // Creating a workspace makes the creator its Owner, so there is exactly
        // one membership row to lose. Proving it is there first stops the
        // assertion afterwards from passing on an empty fixture.
        Assert.Equal(1, await CountMembershipsAsync(userId));

        var delete = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        // workspace_members carries no FK to users, so nothing removes it for
        // free. Left behind, it would keep granting the workspace to an account
        // that no longer exists — and because the member list inner-joins users,
        // the row would not even show up.
        Assert.Equal(0, await CountMembershipsAsync(userId));
        Assert.False(await UserExistsAsync(userId));
    }

    [Fact]
    public async Task DeletingOwnAccount_ShouldKeepTheTaskButClearItsAssignee()
    {
        RequireRelationalDatabase();

        var userId = await RegisterAndSignInAsync("Assignee Delete");
        var wsId = await CreateWorkspaceAsync("Assignee Delete WS");
        var projectId = await CreateProjectAsync(wsId, "Assignee Delete Project");
        var taskId = await CreateTaskAsync(wsId, projectId, "Owned by the departing user");

        var assign = await client.PatchAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks/{taskId}",
            new
            {
                title = "Owned by the departing user",
                description = (string?)null,
                status = "Idea",
                priority = "Medium",
                assigneeId = userId,
                dueDateUtc = (DateTimeOffset?)null,
            });
        Assert.Equal(HttpStatusCode.NoContent, assign.StatusCode);
        Assert.Equal(userId, await ReadAssigneeAsync(taskId));

        var delete = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        // Unassign, never delete: the task belongs to the project, and dropping
        // it would take other people's work along with the account.
        Assert.True(await TaskExistsAsync(taskId));
        Assert.Null(await ReadAssigneeAsync(taskId));
    }

    [Fact]
    public async Task DeletingOwnAccount_ShouldAlsoUnassignTasksThatWereAlreadyDeleted()
    {
        RequireRelationalDatabase();

        // The trap this guards against: TaskItem carries a global
        // DeletedAtUtc == null query filter, so a plain lookup of "tasks
        // assigned to this person" silently skips every soft-deleted one and
        // leaves it pointing at an id that no longer resolves.
        var userId = await RegisterAndSignInAsync("Soft Delete Assignee");
        var wsId = await CreateWorkspaceAsync("Soft Delete WS");
        var projectId = await CreateProjectAsync(wsId, "Soft Delete Project");
        var taskId = await CreateTaskAsync(wsId, projectId, "Deleted but still assigned");

        var assign = await client.PatchAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks/{taskId}",
            new
            {
                title = "Deleted but still assigned",
                description = (string?)null,
                status = "Idea",
                priority = "Medium",
                assigneeId = userId,
                dueDateUtc = (DateTimeOffset?)null,
            });
        Assert.Equal(HttpStatusCode.NoContent, assign.StatusCode);
        Assert.Equal(userId, await ReadAssigneeAsync(taskId));

        // Soft-delete the task while it is still assigned to this account.
        var erase = await client.DeleteAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks/{taskId}");
        Assert.Equal(HttpStatusCode.NoContent, erase.StatusCode);
        Assert.True(await TaskExistsIgnoringQueryFiltersAsync(taskId));
        Assert.False(await TaskExistsAsync(taskId));

        var delete = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        // The row survives soft deletion, so the assignee must have been
        // cleared even though the filtered query would not have seen it.
        Assert.True(await TaskExistsIgnoringQueryFiltersAsync(taskId));
        Assert.Null(await ReadAssigneeIgnoringQueryFiltersAsync(taskId));
    }

    [Fact]
    public async Task DeletingTheSameAccountTwice_ShouldReturn204BothTimes()
    {
        RequireRelationalDatabase();

        var userId = await RegisterAndSignInAsync("Delete Twice");

        var first = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);

        // The access token is a JWT that outlives the row it names for up to a
        // quarter of an hour, so this second call is what a double-click or a
        // retry after a dropped response looks like: still authenticated, with
        // nothing left to delete. It must confirm rather than report a 404.
        var second = await client.DeleteAsync("/api/v1/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);

        Assert.False(await UserExistsAsync(userId));
    }

    // --- helpers -----------------------------------------------------------

    private async Task<Guid> RegisterAndSignInAsync(string displayName)
    {
        username = $"u_{Guid.NewGuid():N}"[..10];

        var userId = await RegistrationFlow.RegisterAsync(client, username, Password, displayName);
        var accessToken = await RegistrationFlow.LoginAsync(client, username, Password);

        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

        return userId;
    }

    private async Task<Guid> CreateWorkspaceAsync(string name)
    {
        var response = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name,
            slug = $"{name.ToLowerInvariant().Replace(' ', '-')}-{Guid.NewGuid():N}"[..40],
            description = "Delete account integration test workspace",
        });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateProjectAsync(Guid wsId, string name)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name,
                key = $"DA{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Delete account integration test project",
            });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    private async Task<Guid> CreateTaskAsync(Guid wsId, Guid projectId, string title)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks",
            new { title, description = (string?)null, priority = "Medium", dueDateUtc = (DateTimeOffset?)null });

        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        return body.GetProperty("id").GetGuid();
    }

    private async Task<bool> UserExistsAsync(Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.Users.AsNoTracking().AnyAsync(u => u.Id == userId);
    }

    private async Task<bool> TaskExistsAsync(Guid taskId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems.AsNoTracking().AnyAsync(t => t.Id == taskId);
    }

    private async Task<int> CountMembershipsAsync(Guid userId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.WorkspaceMembers.AsNoTracking().CountAsync(m => m.UserId == userId);
    }

    private async Task<Guid?> ReadAssigneeAsync(Guid taskId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems.AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => t.AssigneeId)
            .FirstOrDefaultAsync();
    }

    // The two below ignore the global DeletedAtUtc == null filter, because the
    // whole point of the soft-delete test is to look at a row the normal query
    // path refuses to return.

    private async Task<bool> TaskExistsIgnoringQueryFiltersAsync(Guid taskId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems.IgnoreQueryFilters().AsNoTracking()
            .AnyAsync(t => t.Id == taskId);
    }

    private async Task<Guid?> ReadAssigneeIgnoringQueryFiltersAsync(Guid taskId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems.IgnoreQueryFilters().AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => t.AssigneeId)
            .FirstOrDefaultAsync();
    }
}
