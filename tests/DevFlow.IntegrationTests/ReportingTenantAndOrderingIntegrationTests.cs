using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Wave-5b regressions for the reporting endpoints:
/// (1) F3 — the four project-scoped reporting routes authorized the caller
///     against the route workspaceId but never verified the projectId
///     belonged to it, so naming a foreign projectId leaked another tenant's
///     burndown/velocity/lead-time/history. Now every handler rejects the
///     pairing with 404 before any read or cache lookup.
/// (2) G1 — Postgres sorts DESC with NULLS FIRST, so unscheduled (date-less)
///     sprints occupied the velocity report's Take(10) window and crowded
///     the recently-completed sprints out. Only reproducible against real
///     Postgres, hence the Docker guard.
/// </summary>
[Collection("IntegrationTests")]
public class ReportingTenantAndOrderingIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task ReportingEndpoints_ForeignProject_ShouldReturn404()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        await AuthenticateAsync();
        // Two workspaces the same user owns: B is the caller's legitimate
        // membership, A owns the victim project. Pre-fix, every read below
        // answered 200 with workspace A's data.
        var (wsA, projectA) = await CreateWorkspaceAndProjectAsync("Leak A");
        var (wsB, _) = await CreateWorkspaceAndProjectAsync("Home B");

        var reporting = $"/api/v1/workspaces/{wsB}/projects/{projectA}/reporting";

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"{reporting}/velocity")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"{reporting}/cycle-lead-time")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync($"{reporting}/velocity-history")).StatusCode);
        Assert.Equal(
            HttpStatusCode.NotFound,
            (await client.GetAsync(
                $"{reporting}/burndown?startDate=2026-01-01&endDate=2026-01-31")).StatusCode);

        // Same user, correctly paired workspace — must still work.
        Assert.Equal(
            HttpStatusCode.OK,
            (await client.GetAsync(
                $"/api/v1/workspaces/{wsA}/projects/{projectA}/reporting/velocity")).StatusCode);
    }

    [Fact]
    public async Task Velocity_WithUnscheduledSprints_ShouldStillCoverDatedSprints()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        await AuthenticateAsync();
        var (wsId, projectId) = await CreateWorkspaceAndProjectAsync("Velocity");

        // 11 completed, dated sprints (the API requires start->complete
        // transitions; each one ends a week before the next).
        var now = DateTimeOffset.UtcNow;
        for (var i = 1; i <= 11; i++)
        {
            var sprintId = await CreateSprintAsync(wsId, projectId, $"Sprint-{i:D2}");
            await StartSprintAsync(
                wsId,
                projectId,
                sprintId,
                now.AddDays((i - 11) * 7 - 7),
                now.AddDays((i - 11) * 7 - 1));
            await CompleteSprintAsync(wsId, projectId, sprintId);
        }

        // Then date-less backlog sprints: no StartDateUtc/EndDateUtc at all.
        for (var i = 1; i <= 3; i++)
        {
            await CreateSprintAsync(wsId, projectId, $"Unscheduled-{i:D2}");
        }

        var response = await client.GetAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/reporting/velocity");
        Assert.True(response.IsSuccessStatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var sprints = body.GetProperty("sprints").EnumerateArray().ToList();

        // Pre-fix this window filled with the NULL-ended backlog sprints
        // (Postgres DESC sorts NULLs first) and lost the early dated ones.
        Assert.Equal(10, sprints.Count);
        foreach (var sprint in sprints)
        {
            Assert.StartsWith("Sprint-", sprint.GetProperty("sprintName").GetString());
        }

        var names = sprints
            .Select(s => s.GetProperty("sprintName").GetString())
            .ToHashSet();

        // The ten most recent dated sprints cover the window...
        for (var i = 2; i <= 11; i++)
        {
            Assert.Contains($"Sprint-{i:D2}", names);
        }

        // ...and the single oldest is the only one pushed out.
        Assert.DoesNotContain("Sprint-01", names);
    }

    // --- helpers -----------------------------------------------------------

    private async Task AuthenticateAsync()
    {
        var email = $"rep_{Guid.NewGuid():N}@test.io";
        var username = $"r_{Guid.NewGuid():N}".Substring(0, 10);
        var password = "Sup3rSecret!";

        var registerResponse = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username,
            password,
            displayName = "Reporting Tester"
        });
        registerResponse.EnsureSuccessStatusCode();

        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password
        });
        loginResponse.EnsureSuccessStatusCode();

        var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = loginBody.GetProperty("accessToken").GetString();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
    }

    private async Task<(Guid WorkspaceId, Guid ProjectId)> CreateWorkspaceAndProjectAsync(string name)
    {
        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name,
            slug = $"{name.Replace(" ", "-").ToLowerInvariant()}-{Guid.NewGuid():N}",
            description = "Reporting integration test workspace"
        });
        wsResponse.EnsureSuccessStatusCode();
        var wsId = (await wsResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = $"{name} Project",
                key = $"RP{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Reporting integration test project"
            });
        projectResponse.EnsureSuccessStatusCode();
        var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        return (wsId, projectId);
    }

    private async Task<Guid> CreateSprintAsync(Guid wsId, Guid projectId, string sprintName)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/sprints",
            new { name = sprintName, goal = (string?)null });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();
    }

    private async Task StartSprintAsync(Guid wsId, Guid projectId, Guid sprintId, DateTimeOffset start, DateTimeOffset end)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/sprints/{sprintId}/start",
            new { startDateUtc = start, endDateUtc = end });
        response.EnsureSuccessStatusCode();
    }

    private async Task CompleteSprintAsync(Guid wsId, Guid projectId, Guid sprintId)
    {
        var response = await client.PostAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/sprints/{sprintId}/complete",
            content: null);
        response.EnsureSuccessStatusCode();
    }
}
