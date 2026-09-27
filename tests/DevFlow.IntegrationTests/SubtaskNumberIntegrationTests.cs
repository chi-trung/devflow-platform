using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// A project could hold exactly one subtask. <c>CreateSubtaskCommandHandler</c>
/// never called <c>SetNumber</c>, so every subtask row carried the CLR default
/// of 0, and the (project_id, number) unique index on <c>task_items</c>
/// rejected the second insert — a 500 on an ordinary, valid action.
///
/// Only real Postgres reproduces this: the index is what rejects the duplicate,
/// and the InMemory provider enforces no uniqueness. It also evaluates LINQ
/// in-process, so a handler that skipped SetNumber entirely would look fine.
/// The factory silently downgrades to InMemory when the container fails, so
/// the provider is asserted rather than assumed.
/// </summary>
[Collection("IntegrationTests")]
public class SubtaskNumberIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    private void RequireRelationalDatabase()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        Assert.True(
            db.Database.IsRelational(),
            "The unique (project_id, number) index is enforced by the database, not by " +
            "EF InMemory. Against that fallback this class would pass against the exact " +
            "bug it exists to catch.");
    }

    [Fact]
    public async Task AProjectShouldHoldMoreThanOneSubtask()
    {
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Sub");
        var parentId = await CreateTaskAsync(wsId, projectId, "Parent story");

        // The first one always worked — it was the only number 0 the index had
        // not seen yet. The failure only began with the second.
        var first = await CreateSubtaskAsync(wsId, projectId, parentId, "First step");
        var second = await CreateSubtaskAsync(wsId, projectId, parentId, "Second step");
        var third = await CreateSubtaskAsync(wsId, projectId, parentId, "Third step");

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(HttpStatusCode.Created, third.StatusCode);

        var subtaskNumbers = await ReadSubtaskNumbersAsync(projectId, parentId);
        var parentNumber = await ReadNumberAsync(parentId);

        // Subtasks draw from the same per-project sequence as top-level tasks —
        // that is what the {Project.Key}-{Number} key a person reads depends on.
        // The parent took 1, so its three subtasks follow it rather than
        // restarting at 1 and colliding with it.
        Assert.Equal(1, parentNumber);
        Assert.Equal(new[] { 2, 3, 4 }, subtaskNumbers.OrderBy(n => n).ToArray());
    }

    [Fact]
    public async Task SubtasksAndTasks_ShouldNotContendForTheSameNumber()
    {
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Sub");
        var parentId = await CreateTaskAsync(wsId, projectId, "Parent story");

        // Interleave the two writers. Subtasks and top-level tasks draw from
        // one per-project sequence, so a subtask that does not read the current
        // max is not merely untidy — it asks the database for a number the
        // neighbouring task already holds.
        var first = await CreateSubtaskAsync(wsId, projectId, parentId, "Step one");
        await CreateTaskAsync(wsId, projectId, "Task between one and two");
        var second = await CreateSubtaskAsync(wsId, projectId, parentId, "Step two");
        await CreateTaskAsync(wsId, projectId, "Task between two and three");
        var third = await CreateSubtaskAsync(wsId, projectId, parentId, "Step three");

        Assert.Equal(HttpStatusCode.Created, first.StatusCode);
        Assert.Equal(HttpStatusCode.Created, second.StatusCode);
        Assert.Equal(HttpStatusCode.Created, third.StatusCode);

        // No number may appear twice in a project — that is precisely the
        // uniqueness the (project_id, number) index enforces.
        var all = await ReadProjectNumbersAsync(projectId);

        Assert.Equal(6, all.Length);
        Assert.Equal(all.Length, all.Distinct().Count());
    }

    // --- helpers -----------------------------------------------------------

    private async Task AuthenticateAsync()
    {
        await RegistrationFlow.AuthenticateAsync(factory, client, "Subtask Tester");
    }

    private async Task<(Guid WorkspaceId, Guid ProjectId)> CreateWorkspaceAndProjectAsync(string name)
    {
        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name,
            slug = $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}",
            description = "Subtask numbering integration test workspace"
        });
        wsResponse.EnsureSuccessStatusCode();
        var wsId = (await wsResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = $"{name} Project",
                key = $"SU{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Subtask numbering integration test project"
            });
        projectResponse.EnsureSuccessStatusCode();
        var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        return (wsId, projectId);
    }

    private async Task<Guid> CreateTaskAsync(Guid wsId, Guid projectId, string title)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks",
            new { title, description = (string?)null, priority = "Medium", dueDateUtc = (DateTimeOffset?)null });
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();
    }

    private Task<HttpResponseMessage> CreateSubtaskAsync(
        Guid wsId, Guid projectId, Guid parentId, string title) =>
        client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks/{parentId}/subtasks",
            new { title, description = (string?)null, priority = "Medium" });

    private async Task<int[]> ReadSubtaskNumbersAsync(Guid projectId, Guid parentId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems
            .AsNoTracking()
            .Where(t => t.ParentTaskId == parentId)
            .Select(t => t.Number)
            .ToArrayAsync();
    }

    private async Task<int> ReadNumberAsync(Guid taskId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems
            .AsNoTracking()
            .Where(t => t.Id == taskId)
            .Select(t => t.Number)
            .SingleAsync();
    }

    private async Task<int[]> ReadProjectNumbersAsync(Guid projectId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.TaskItems
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .Select(t => t.Number)
            .ToArrayAsync();
    }
}
