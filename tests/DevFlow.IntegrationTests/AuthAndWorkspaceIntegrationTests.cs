using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace DevFlow.IntegrationTests;

[Collection("IntegrationTests")]
public class AuthAndWorkspaceIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task Register_Login_CreateWorkspace_Flow()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        // 1. Register
        var email = $"user_{Guid.NewGuid():N}@test.io";
        var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        var password = "Sup3rSecret!";

        var userId = await RegistrationFlow.RegisterAsync(
            client, email, username, password, "Test User");

        // 2. Verify — a fresh account may not hold a session until the address
        // is proven, so this step replaces the old direct login.
        var accessToken = await RegistrationFlow.VerifyAsync(factory, client, userId);
        Assert.False(string.IsNullOrEmpty(accessToken));

        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);

        // Signing in with a password works only once verified, which is what
        // makes the gate above meaningful.
        var loginResponse = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            email,
            password
        });
        Assert.True(loginResponse.IsSuccessStatusCode);

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
        var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaces = listBody.GetProperty("items");
        Assert.True(workspaces.GetArrayLength() >= 1);
        var createdWs = workspaces[0];
        Assert.Equal("Test Workspace", createdWs.GetProperty("name").GetString());
    }
}
