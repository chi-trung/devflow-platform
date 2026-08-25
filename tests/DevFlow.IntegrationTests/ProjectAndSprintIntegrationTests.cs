using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DevFlow.IntegrationTests;

public class ProjectAndSprintIntegrationTests(DevFlowWebApplicationFactory factory) : IClassFixture<DevFlowWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task Register_CreateProjectSprintTask_AndUpdateFlow()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var email = $"user_{Guid.NewGuid():N}@test.io";
        var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        var password = "Sup3rSecret!";

        // 1. Register
        var registerResponse = await client.PostAsJsonAsync("/api/v1/auth/register", new
        {
            email,
            username,
            password,
            displayName = "Project User"
        });

        if (!registerResponse.IsSuccessStatusCode)
        {
            var errorBody = await registerResponse.Content.ReadAsStringAsync();
            throw new Exception($"Register failed with {registerResponse.StatusCode}: {errorBody}");
        }

        // 2. Login
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password
        });

        Assert.True(loginResponse.IsSuccessStatusCode);
        var loginBody = await loginResponse.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = loginBody.GetProperty("accessToken").GetString();
        Assert.False(string.IsNullOrEmpty(accessToken));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // 3. Create Workspace
        var wsResponse = await client.PostAsJsonAsync("/api/v1/workspaces", new
        {
            name = "Project Workspace",
            slug = $"proj-ws-{Guid.NewGuid():N}",
            description = "Integration test workspace"
        });

        Assert.True(wsResponse.IsSuccessStatusCode);
        var wsBody = await wsResponse.Content.ReadFromJsonAsync<JsonElement>();
        var wsId = wsBody.GetProperty("id").GetGuid();

        // 4. Create Project
        var projectResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects",
            new { name = "Core Platform", key = $"CORE{Guid.NewGuid():N}"[..7].ToUpperInvariant(), description = "Project test" });

        Assert.True(projectResponse.IsSuccessStatusCode);
        var projectBody = await projectResponse.Content.ReadFromJsonAsync<JsonElement>();
        var projectId = projectBody.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, projectId);

        // 5. Create Sprint
        var sprintResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/sprints",
            new { name = "Sprint 1", goal = "Ship the board" });

        Assert.True(sprintResponse.IsSuccessStatusCode);
        var sprintBody = await sprintResponse.Content.ReadFromJsonAsync<JsonElement>();
        var sprintId = sprintBody.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, sprintId);

        // 6. Create Task
        var taskResponse = await client.PostAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks",
            new { title = "Design login", description = "Auth flow", priority = "High", dueDateUtc = (DateTimeOffset?)null });

        Assert.True(taskResponse.IsSuccessStatusCode);
        var taskBody = await taskResponse.Content.ReadFromJsonAsync<JsonElement>();
        var taskId = taskBody.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, taskId);

        // 7. PATCH task to InProgress
        var patchResponse = await client.PatchAsJsonAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks/{taskId}",
            new { title = "Design login", description = "Auth flow", status = "InProgress", priority = "High", assigneeId = (Guid?)null, dueDateUtc = (DateTimeOffset?)null });

        Assert.True(patchResponse.IsSuccessStatusCode);

        // 8. Verify via list
        var listResponse = await client.GetAsync(
            $"/api/v1/workspaces/{wsId}/projects/{projectId}/tasks?status=InProgress");
        Assert.True(listResponse.IsSuccessStatusCode);
        var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var items = listBody.GetProperty("items");
        Assert.True(items.GetArrayLength() >= 1);
    }
}
