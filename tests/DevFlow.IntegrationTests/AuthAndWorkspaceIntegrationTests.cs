using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DevFlow.IntegrationTests;

public class AuthAndWorkspaceIntegrationTests(DevFlowWebApplicationFactory factory) : IClassFixture<DevFlowWebApplicationFactory>
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task Register_Login_CreateWorkspace_Flow()
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
            displayName = "Test User"
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
            name = "Test Workspace",
            slug = $"test-ws-{Guid.NewGuid():N}",
            description = "Integration test workspace"
        });

        Assert.True(wsResponse.IsSuccessStatusCode);
        var wsBody = await wsResponse.Content.ReadFromJsonAsync<JsonElement>();
        var wsId = wsBody.GetProperty("id").GetGuid();
        Assert.NotEqual(Guid.Empty, wsId);

        // 4. List Workspaces
        var listResponse = await client.GetAsync("/api/v1/workspaces");
        Assert.True(listResponse.IsSuccessStatusCode);
        var workspaces = await listResponse.Content.ReadFromJsonAsync<JsonElement[]>();
        Assert.NotNull(workspaces);
        var createdWs = Assert.Single(workspaces);
        Assert.Equal("Test Workspace", createdWs.GetProperty("name").GetString());
    }
}
