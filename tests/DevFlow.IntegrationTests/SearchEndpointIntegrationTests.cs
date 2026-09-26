using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Global search used to return 500 for every non-blank keyword. The task and
/// project queries projected <c>enum.ToString()</c> inside <c>.Select()</c>,
/// which Npgsql cannot translate — so the failure only surfaced once a keyword
/// reached the repository, and a blank keyword short-circuits before it does.
///
/// Only real Postgres reproduces this. The EF InMemory provider evaluates LINQ
/// in-process, where <c>.ToString()</c> on an enum simply works, and
/// <c>EF.Functions.ILike</c> — which the keyword filter depends on — is an
/// Npgsql-only function. Against the InMemory fallback this whole class would
/// pass against the exact bug it exists to catch, so the provider is asserted
/// rather than assumed.
/// </summary>
[Collection("IntegrationTests")]
public class SearchEndpointIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    /// <summary>
    /// The factory catches every container failure — a slow image pull included
    /// — and silently swaps in InMemory. A test that merely ran would then be
    /// green for the wrong reason, so make the downgrade a hard failure here.
    /// </summary>
    private void RequireRelationalDatabase()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        Assert.True(
            db.Database.IsRelational(),
            "Search fell back to the InMemory provider, which cannot translate the query " +
            "this test exists to exercise. Both the enum projection and EF.Functions.ILike " +
            "need a real Npgsql connection.");
    }

    [Fact]
    public async Task Search_WithKeyword_ShouldReturn200_AndTheMatchingTask()
    {
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Search");
        var projectKey = await GetProjectKeyAsync(projectId);
        var unique = $"needle{Guid.NewGuid():N}"[..14];
        await CreateTaskAsync(wsId, projectId, $"Find the {unique} in the haystack");

        var response = await client.GetAsync(
            $"/api/v1/workspaces/{wsId}/search?q={unique}");

        Assert.True(
            response.IsSuccessStatusCode,
            $"Search returned {(int)response.StatusCode} for a keyword that matches one task.");

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var tasks = body.GetProperty("tasks").EnumerateArray().ToList();

        Assert.Single(tasks);
        var task = tasks[0];

        // The repository now carries the enum; the wire contract must not have
        // moved with it, or every status filter the SPA renders breaks silently.
        Assert.Equal("Idea", task.GetProperty("status").GetString());
        Assert.Equal(projectKey, task.GetProperty("projectKey").GetString());
    }

    [Fact]
    public async Task Search_WithKeyword_ShouldReturn200_WhenTheProjectItselfMatches()
    {
        // Same defect on the projects branch: Project.Status.ToString() inside
        // the projection. Matching only the project name, with no task involved,
        // is what isolates it from the task query above.
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Search");
        var marker = $"proj{Guid.NewGuid():N}"[..10];

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = $"Board {marker}",
                key = $"SP{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Project-name search fixture"
            });
        projectResponse.EnsureSuccessStatusCode();

        var response = await client.GetAsync($"/api/v1/workspaces/{wsId}/search?q={marker}");

        Assert.True(
            response.IsSuccessStatusCode,
            $"Search returned {(int)response.StatusCode} for a keyword that matches one project.");

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var projects = body.GetProperty("projects").EnumerateArray().ToList();

        var match = Assert.Single(projects);
        Assert.Equal($"Board {marker}", match.GetProperty("name").GetString());
        Assert.Equal("Active", match.GetProperty("status").GetString());
    }

    [Fact]
    public async Task Search_WithoutKeyword_ShouldStillReturnAnEmpty200()
    {
        // The blank-keyword path never reaches the repository, which is why the
        // outage looked intermittent. Pin it so a future guard does not turn it
        // into a 400.
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, _) = await CreateWorkspaceAndProjectAsync("Search");

        var response = await client.GetAsync($"/api/v1/workspaces/{wsId}/search?q=");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    // --- helpers -----------------------------------------------------------


    private async Task AuthenticateAsync()
    {
        await RegistrationFlow.AuthenticateAsync(factory, client, "Search Tester");
    }

    private async Task<(Guid WorkspaceId, Guid ProjectId)> CreateWorkspaceAndProjectAsync(string name)
    {
        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name,
            slug = $"{name.Replace(" ", "-").ToLowerInvariant()}-{Guid.NewGuid():N}",
            description = "Search integration test workspace"
        });
        wsResponse.EnsureSuccessStatusCode();
        var wsId = (await wsResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = $"{name} Project",
                key = $"SR{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Search integration test project"
            });
        projectResponse.EnsureSuccessStatusCode();
        var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        return (wsId, projectId);
    }

    private async Task<string> GetProjectKeyAsync(Guid projectId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        return await db.Projects
            .AsNoTracking()
            .Where(p => p.Id == projectId)
            .Select(p => p.Key)
            .SingleAsync();
    }

    private async Task CreateTaskAsync(Guid wsId, Guid projectId, string title)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks",
            new { title, description = (string?)null, priority = "Medium", dueDateUtc = (DateTimeOffset?)null });
        response.EnsureSuccessStatusCode();
    }
}
