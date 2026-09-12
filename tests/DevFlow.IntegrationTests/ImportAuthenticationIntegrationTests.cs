using System.Net;
using System.Text;

namespace DevFlow.IntegrationTests;

/// <summary>
/// Regression (wave 5b hand-audit): ImportController was the only write
/// controller in the API without [Authorize], and the app has no fallback
/// auth policy — so both import endpoints accepted anonymous POSTs and
/// created tasks in any project by id. These probes lock the 401 so a future
/// attribute removal fails CI instead of silently re-opening the endpoint.
/// </summary>
[Collection("IntegrationTests")]
public class ImportAuthenticationIntegrationTests(DevFlowWebApplicationFactory factory)
{
    private readonly HttpClient client = factory.CreateClient();

    [Fact]
    public async Task AnonymousPostTasks_ShouldReturn401()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var response = await client.PostAsync(
            $"/api/v1/workspaces/{Guid.NewGuid()}/projects/{Guid.NewGuid()}/import/tasks",
            new StringContent(
                "Title,Status,Priority\nAnonymous task,Idea,Medium\n",
                Encoding.UTF8,
                "text/csv"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task AnonymousPostBackup_ShouldReturn401()
    {
        if (!DevFlowWebApplicationFactory.IsDockerAvailable)
        {
            return;
        }

        var response = await client.PostAsync(
            $"/api/v1/workspaces/{Guid.NewGuid()}/projects/{Guid.NewGuid()}/import/backup",
            new StringContent("{}", Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
