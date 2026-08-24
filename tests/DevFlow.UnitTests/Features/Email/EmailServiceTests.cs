using System.Net;
using System.Net.Http;
using System.Text.Json;
using DevFlow.Application.Features.Email;
using DevFlow.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Email;

public class EmailServiceTests
{
    [Fact]
    public void NoOpEmailService_ShouldReturnCompletedTasks()
    {
        var service = new NoOpEmailService();

        Assert.Equal(Task.CompletedTask, service.SendTaskAssignedEmailAsync("a@x.io", "T", "P", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendMentionEmailAsync("a@x.io", "T", "c", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendSprintStartedEmailAsync("a@x.io", "S", "P", "w", "p", "s"));
        Assert.Equal(Task.CompletedTask, service.SendTaskStatusChangedEmailAsync("a@x.io", "T", "P", "Done", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendCommentAddedEmailAsync("a@x.io", "T", "P", "c", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendRoleChangedEmailAsync("a@x.io", "W", "Admin", "B", "w"));
        Assert.Equal(Task.CompletedTask, service.SendRemovedFromWorkspaceEmailAsync("a@x.io", "W", "B", "w"));
    }

    [Fact]
    public async Task ResendEmailService_ShouldPostExpectedPayload()
    {
        var handler = new CapturingHandler();
        var httpClient = new HttpClient(handler);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RESEND_API_KEY"] = "test-key",
                ["FRONTEND_URL"] = "https://app.devflow.io",
            })
            .Build();

        var service = new ResendEmailService(httpClient, configuration);

        await service.SendRoleChangedEmailAsync(
            "alice@devflow.io", "DevFlow Workspace", "Admin", "Bob", "workspace-123");

        var request = Assert.Single(handler.Requests);
        Assert.Equal("https://api.resend.com/emails", request.RequestUri?.ToString());
        Assert.Equal("Bearer test-key", request.Headers.Authorization?.ToString());

        var body = await request.Content!.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        Assert.Equal("alice@devflow.io", root.GetProperty("to")[0].GetString());
        Assert.Contains("DevFlow Workspace", root.GetProperty("html").GetString());
        Assert.Contains("https://app.devflow.io/workspaces/workspace-123", root.GetProperty("html").GetString());
    }

    [Fact]
    public async Task ResendEmailService_ShouldThrow_OnNonSuccessResponse()
    {
        var handler = new FixedStatusHandler(HttpStatusCode.InternalServerError);
        var httpClient = new HttpClient(handler);
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["RESEND_API_KEY"] = "test-key",
            })
            .Build();

        var service = new ResendEmailService(httpClient, configuration);

        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            service.SendMentionEmailAsync("a@x.io", "T", "c", "B", "w", "p", "t"));
    }

    private sealed class CapturingHandler : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = new();

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK));
        }
    }

    private sealed class FixedStatusHandler(HttpStatusCode status) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            return Task.FromResult(new HttpResponseMessage(status));
        }
    }
}
