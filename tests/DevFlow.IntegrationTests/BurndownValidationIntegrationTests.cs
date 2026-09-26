using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace DevFlow.IntegrationTests;

/// <summary>
/// The burndown handler derives its whole series from
/// <c>EndDate - StartDate</c>. With no validator, a blank date parameter bound
/// to <c>DateOnly</c>'s default and a reversed range produced a negative day
/// count — both answered 200 with an empty <c>points</c> array, so the chart
/// drew nothing and the reader had no way to tell a bug from a quiet sprint.
///
/// Asserted at the HTTP boundary because the fix is a pipeline behavior, not
/// handler logic: <c>ValidationBehavior</c> only fires for a request that has a
/// validator, and this is the first Query in the codebase to have one.
/// </summary>
[Collection("IntegrationTests")]
public class BurndownValidationIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task Burndown_WithoutDates_ShouldReturn400()
    {
        var reporting = await CreateReportingScopeAsync();

        var response = await client.GetAsync($"{reporting}/burndown");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Burndown_WithBlankDateParameters_ShouldReturn400()
    {
        var reporting = await CreateReportingScopeAsync();

        // What the browser actually sends when a date input is left empty.
        var response = await client.GetAsync($"{reporting}/burndown?startDate=&endDate=");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Burndown_WithEndBeforeStart_ShouldReturn400()
    {
        var reporting = await CreateReportingScopeAsync();

        var response = await client.GetAsync(
            $"{reporting}/burndown?startDate=2026-10-03&endDate=2026-09-19");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Burndown_WithAValidRange_ShouldReturn200_AndOnePointPerDay()
    {
        var reporting = await CreateReportingScopeAsync();

        var response = await client.GetAsync(
            $"{reporting}/burndown?startDate=2026-09-14&endDate=2026-09-20");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var points = body.GetProperty("points").EnumerateArray().ToList();

        // Inclusive of both ends, so a 7-day span is 7 points.
        Assert.Equal(7, points.Count);
    }

    private async Task<string> CreateReportingScopeAsync()
    {
        await RegistrationFlow.AuthenticateAsync(factory, client, "Burndown Tester");

        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name = "Burndown Validation",
            slug = $"burndown-{Guid.NewGuid():N}",
            description = "Burndown validation integration test workspace"
        });
        wsResponse.EnsureSuccessStatusCode();
        var wsId = (await wsResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new
            {
                name = "Burndown Validation Project",
                key = $"BD{Guid.NewGuid():N}"[..7].ToUpperInvariant(),
                description = "Burndown validation integration test project"
            });
        projectResponse.EnsureSuccessStatusCode();
        var projectId = (await projectResponse.Content.ReadFromJsonAsync<JsonElement>())
            .GetProperty("id").GetGuid();

        // A workspace the caller genuinely belongs to, so a 400 here can only
        // come from the date validator and not from the tenant check.
        return $"/api/v1/workspaces/{wsId}/projects/{projectId}/reporting";
    }
}
