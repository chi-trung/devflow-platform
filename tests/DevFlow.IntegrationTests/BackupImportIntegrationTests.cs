using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using DevFlow.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Restoring a backup failed with a 500, always. The import handler staged
/// every task in the backup and saved them in a single <c>SaveChanges</c> at the
/// end, but never assigned a <c>Number</c> — so each row carried the CLR
/// default of 0 and the (project_id, number) unique index rejected the batch.
/// One task happened to survive only because 0 was still free.
///
/// The export endpoint is the fixture: its own output is fed straight back in,
/// so a drift between the two shapes cannot make this pass for the wrong
/// reason. Only real Postgres reproduces the failure — the index is enforced by
/// the database, and the InMemory provider enforces no uniqueness at all — so
/// the provider is asserted rather than assumed.
/// </summary>
[Collection("IntegrationTests")]
public class BackupImportIntegrationTests(DevFlowWebApplicationFactory factory)
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
    public async Task ExportingThenReimportingTheSameBackup_ShouldSucceed()
    {
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Backup");

        await CreateTaskAsync(wsId, projectId, "Alpha");
        await CreateTaskAsync(wsId, projectId, "Beta");
        var parentId = await CreateTaskAsync(wsId, projectId, "Parent story");
        await CreateSubtaskAsync(wsId, projectId, parentId, "Alpha step");

        var backup = await ExportBackupAsync(wsId, projectId);
        var before = await ReadProjectNumbersAsync(projectId);

        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/import/backup",
            backup);

        Assert.True(
            response.IsSuccessStatusCode,
            $"Re-importing an unmodified export returned {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();

        Assert.Equal(4, body.GetProperty("tasksImported").GetInt32());
        Assert.Empty(body.GetProperty("errors").EnumerateArray());

        // The batch was added on top of rows that were already there, so every
        // number in the project must still be distinct.
        var after = await ReadProjectNumbersAsync(projectId);

        Assert.Equal(8, after.Length);
        Assert.Equal(after.Length, after.Distinct().Count());
        Assert.Equal(4, after.Count(n => n > before.Max()));

        // The subtask's parent is re-linked in a second pass that reads the row
        // back by id. At that point every row is staged but not yet written, so
        // a database read finds nothing and the link is dropped without any
        // error. Both copies of the subtask — the original and the one this
        // import just staged — must still know its parent.
        var subtasks = (await ReadParentLinksAsync(projectId))
            .Where(l => l.Title == "Alpha step")
            .ToList();

        Assert.Equal(2, subtasks.Count);
        Assert.All(subtasks, s => Assert.NotNull(s.Parent));
    }

    [Fact]
    public async Task ReimportingTwice_ShouldStillKeepEveryNumberUnique()
    {
        // A restore is run more than once in practice — a second attempt after a
        // partial failure, or a deliberate merge. Numbers are the thing the
        // unique index is watching, so repeating the import must stay legal.
        RequireRelationalDatabase();

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Backup");

        await CreateTaskAsync(wsId, projectId, "One");
        await CreateTaskAsync(wsId, projectId, "Two");
        await CreateTaskAsync(wsId, projectId, "Three");

        var backup = await ExportBackupAsync(wsId, projectId);

        for (var round = 1; round <= 2; round++)
        {
            var response = await client.PostAsJsonAsync(
                $"/api/v1/workspaces/{wsId}/projects/{projectId}/import/backup",
                backup);

            Assert.True(
                response.IsSuccessStatusCode,
                $"Import round {round} returned {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
        }

        var numbers = await ReadProjectNumbersAsync(projectId);

        Assert.Equal(9, numbers.Length);
        Assert.Equal(numbers.Length, numbers.Distinct().Count());
    }

    // --- helpers -----------------------------------------------------------

    private async Task AuthenticateAsync()
    {
        await RegistrationFlow.AuthenticateAsync(factory, client, "Backup Tester");
    }

    private async Task<(Guid WorkspaceId, Guid ProjectId)> CreateWorkspaceAndProjectAsync(string name)
    {
        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name,
            slug = $"{name.ToLowerInvariant()}-{Guid.NewGuid():N}",
            description = "Backup import integration test workspace"
        });
        wsResponse.EnsureSuccessStatusCode();
        var wsId = (await wsResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = $"{name} Project",
                key = $"BK{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Backup import integration test project"
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

    /// <summary>
    /// The export endpoint's own output, unmodified. Feeding it straight back
    /// keeps the test honest about the shape the two halves actually agree on.
    /// </summary>
    private async Task<JsonElement> ExportBackupAsync(Guid wsId, Guid projectId)
    {
        var response = await client.GetAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/export/backup");

        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<JsonElement>();
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

    private async Task<List<(string Title, Guid? Parent)>> ReadParentLinksAsync(Guid projectId)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DevFlowDbContext>();

        var rows = await db.TaskItems
            .AsNoTracking()
            .Where(t => t.ProjectId == projectId)
            .Select(t => new { t.Title, t.ParentTaskId })
            .ToListAsync();

        return rows.Select(r => (r.Title, r.ParentTaskId)).ToList();
    }
}
