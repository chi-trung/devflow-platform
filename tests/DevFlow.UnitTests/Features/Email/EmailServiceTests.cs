using System.Net;
using System.Net.Http;
using System.Text.Json;
using DevFlow.Application.Features.Email;
using DevFlow.Infrastructure.Email;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using NSubstitute;

namespace DevFlow.UnitTests.Features.Email;

public class EmailServiceTests
{
    private static ResendEmailService CreateService(HttpClient httpClient, IDictionary<string, string?> settings)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(settings)
            .Build();

        // The composer is shared with the SMTP transport, so the wording under
        // test here is the wording that transport would send too.
        var composer = new EmailComposer(
            (configuration["FRONTEND_URL"] ?? "http://localhost:5173").TrimEnd('/'));

        return new ResendEmailService(
            httpClient,
            composer,
            configuration,
            Substitute.For<ILogger<ResendEmailService>>());
    }

    [Fact]
    public void NoOpEmailService_ShouldReturnCompletedTasks()
    {
        var service = new NoOpEmailService();

        Assert.Equal(Task.CompletedTask, service.SendEmailVerificationAsync("a@x.io", "N", "u"));
        Assert.Equal(Task.CompletedTask, service.SendTaskAssignedEmailAsync("a@x.io", "T", "P", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendMentionEmailAsync("a@x.io", "T", "c", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendSprintStartedEmailAsync("a@x.io", "S", "P", "w", "p", "s"));
        Assert.Equal(Task.CompletedTask, service.SendTaskStatusChangedEmailAsync("a@x.io", "T", "P", "Done", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendCommentAddedEmailAsync("a@x.io", "T", "P", "c", "B", "w", "p", "t"));
        Assert.Equal(Task.CompletedTask, service.SendRoleChangedEmailAsync("a@x.io", "W", "Admin", "B", "w"));
        Assert.Equal(Task.CompletedTask, service.SendRemovedFromWorkspaceEmailAsync("a@x.io", "W", "B", "w"));
        Assert.Equal(Task.CompletedTask, service.SendWorkspaceInviteEmailAsync("a@x.io", "W", "B", "Member", "w"));
    }

    /// <summary>
    /// Without a provider the verification link is still produced and logged.
    /// A silent no-op here would strand every account registered on a
    /// deployment that has no mail key.
    /// </summary>
    [Fact]
    public async Task ConsoleLogEmailService_ShouldStillAcceptVerificationLink()
    {
        var service = new ConsoleLogEmailService(Substitute.For<ILogger<ConsoleLogEmailService>>());

        await service.SendEmailVerificationAsync("a@x.io", "Dev", "https://app/verify-email?token=abc");
    }

    [Fact]
    public async Task ResendEmailService_ShouldPostExpectedPayload()
    {
        var handler = new CapturingHandler();
        var httpClient = new HttpClient(handler);

        var service = CreateService(httpClient, new Dictionary<string, string?>
        {
            ["RESEND_API_KEY"] = "test-key",
            ["FRONTEND_URL"] = "https://app.devflow.io",
        });

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
    public async Task ResendEmailService_ShouldEncodeUserSuppliedText_InHtmlBody()
    {
        // Task titles and comment bodies are attacker-controllable. A task
        // titled with a script tag must arrive as text, not as markup, or it
        // executes in the recipient's mail client.
        var handler = new CapturingHandler();
        var httpClient = new HttpClient(handler);

        var service = CreateService(httpClient, new Dictionary<string, string?>
        {
            ["RESEND_API_KEY"] = "test-key",
            ["FRONTEND_URL"] = "https://app.devflow.io",
        });

        await service.SendCommentAddedEmailAsync(
            "victim@devflow.io",
            "<script>alert('title')</script>",
            "Project",
            "<img src=x onerror=alert('body')>",
            "Mallory",
            "w",
            "p",
            "t");

        var request = Assert.Single(handler.Requests);
        var body = await request.Content!.ReadAsStringAsync();
        var html = JsonDocument.Parse(body).RootElement.GetProperty("html").GetString()!;

        // The layout has no <img> and no <script> of its own, so any real tag
        // of either kind in the output could only have come from the user. A
        // bare "onerror=" substring is not a useful check: the text survives
        // harmlessly inside an escaped string — "&lt;img src=x onerror=…&gt;"
        // is inert, it never opens a tag.
        Assert.DoesNotContain("<script", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("<img", html, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("</script", html, StringComparison.OrdinalIgnoreCase);

        // ...and the payload is still readable, which is the whole point of
        // encoding rather than stripping.
        Assert.Contains("&lt;script&gt;alert(&#39;title&#39;)&lt;/script&gt;", html);
        Assert.Contains("&lt;img src=x onerror=alert(&#39;body&#39;)&gt;", html);
    }

    [Fact]
    public async Task ResendEmailService_ShouldThrow_OnNonSuccessResponse()
    {
        var handler = new FixedStatusHandler(HttpStatusCode.InternalServerError);
        var httpClient = new HttpClient(handler);

        var service = CreateService(httpClient, new Dictionary<string, string?>
        {
            ["RESEND_API_KEY"] = "test-key",
        });

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
