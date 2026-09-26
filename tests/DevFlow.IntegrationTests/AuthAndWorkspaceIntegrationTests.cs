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

        // 1. Register — no address is collected, so there is nothing to verify
        // and no step to wait for. The account is usable immediately, which is
        // the point of dropping the email field: signing up never depended on
        // a mail provider.
        var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        var password = "Sup3rSecret!";

        var userId = await RegistrationFlow.RegisterAsync(
            client, username, password, "Test User");
        Assert.NotEqual(Guid.Empty, userId);

        // 2. Sign in with the username, the only identifier the account has.
        var accessToken = await RegistrationFlow.LoginAsync(client, username, password);
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
        var listBody = await listResponse.Content.ReadFromJsonAsync<JsonElement>();
        var workspaces = listBody.GetProperty("items");
        Assert.True(workspaces.GetArrayLength() >= 1);
        var createdWs = workspaces[0];
        Assert.Equal("Test Workspace", createdWs.GetProperty("name").GetString());
    }

    /// <summary>
    /// Every account this flow creates has email = null, and the unique index
    /// on that column covers all of them. Postgres treats NULLs as distinct, so
    /// a plain unique index would happen to work — but that is a database
    /// default this schema chose not to rely on, and the index is declared
    /// partial instead. If the filter were ever dropped, or the second
    /// registration started failing with a unique violation, this is the test
    /// that would notice; nothing else registers more than one account per
    /// database.
    /// </summary>
    [Fact]
    public async Task Register_MultipleAccountsWithNoEmail_AllSucceed()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        for (var i = 0; i < 3; i++)
        {
            var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
            var userId = await RegistrationFlow.RegisterAsync(
                client, username, "Sup3rSecret!", $"No Email User {i}");

            Assert.NotEqual(Guid.Empty, userId);
        }
    }

    /// <summary>
    /// The identity claim an email-less account gets. JwtTokenProvider only
    /// adds the email claim when there is an address, and constructing a
    /// Claim with a null value throws — so a missing claim is the difference
    /// between "not linked yet" and a 500 on every single sign-in.
    /// </summary>
    [Fact]
    public async Task Login_ReturnsUsableToken_WhenAccountHasNoEmail()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var username = $"u_{Guid.NewGuid():N}".Substring(0, 10);
        await RegistrationFlow.RegisterAsync(client, username, "Sup3rSecret!", "Token User");

        var response = await client.PostAsJsonAsync("/api/v1/auth/login", new
        {
            username,
            password = "Sup3rSecret!",
        });

        Assert.True(response.IsSuccessStatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElement>();
        var accessToken = body.GetProperty("accessToken").GetString()!;
        Assert.False(string.IsNullOrEmpty(accessToken));

        // The token has to actually work, not merely exist.
        client.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", accessToken);

        var meResponse = await client.GetAsync("/api/v1/auth/me");
        Assert.True(meResponse.IsSuccessStatusCode);

        var me = await meResponse.Content.ReadFromJsonAsync<JsonElement>();
        Assert.Equal(username, me.GetProperty("username").GetString());
        Assert.Equal(
            System.Text.Json.JsonValueKind.Null,
            me.GetProperty("email").ValueKind);
    }
}
