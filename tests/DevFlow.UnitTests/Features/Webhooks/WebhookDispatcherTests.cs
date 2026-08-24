using System.Net;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Infrastructure;
using NSubstitute;
using Xunit;

namespace DevFlow.UnitTests.Features.Webhooks;

public class WebhookDispatcherTests
{
    private static IWebhookRepository StubWebhooks(params Webhook[] webhooks)
    {
        var repo = Substitute.For<IWebhookRepository>();
        repo.GetByWorkspaceIdAsync(Arg.Any<Guid>(), Arg.Any<CancellationToken>())
            .Returns(webhooks);
        return repo;
    }

    private static IHttpClientFactory StubHttpClient(HttpMessageHandler handler)
    {
        var factory = Substitute.For<IHttpClientFactory>();
        factory.CreateClient("Webhooks")
            .Returns(new HttpClient(handler));
        return factory;
    }

    [Fact]
    public async Task DispatchAsync_Throws_WhenWebhookRespondsWithFailure()
    {
        // Simulate an endpoint that returns 500.
        var handler = new StubHttpMessageHandler(HttpStatusCode.InternalServerError);
        var dispatcher = new WebhookDispatcher(
            StubWebhooks(Webhook.Create(Guid.NewGuid(), "https://example.com/hook", ["sprint.started"], null)),
            StubHttpClient(handler));

        var workspaceId = Guid.NewGuid();

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            dispatcher.DispatchAsync(workspaceId, "sprint.started", new { sprintId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task DispatchAsync_Throws_WhenEndpointUnreachable()
    {
        // Simulate a connection failure (e.g. DNS / refused).
        var handler = new StubHttpMessageHandler(new HttpRequestException("Connection refused"));
        var dispatcher = new WebhookDispatcher(
            StubWebhooks(Webhook.Create(Guid.NewGuid(), "https://example.com/hook", ["sprint.started"], null)),
            StubHttpClient(handler));

        var workspaceId = Guid.NewGuid();

        await Assert.ThrowsAsync<HttpRequestException>(() =>
            dispatcher.DispatchAsync(workspaceId, "sprint.started", new { sprintId = Guid.NewGuid() }));
    }

    [Fact]
    public async Task DispatchAsync_Completes_WhenWebhookSucceeds()
    {
        var handler = new StubHttpMessageHandler(HttpStatusCode.OK);
        var dispatcher = new WebhookDispatcher(
            StubWebhooks(Webhook.Create(Guid.NewGuid(), "https://example.com/hook", ["sprint.started"], null)),
            StubHttpClient(handler));

        var workspaceId = Guid.NewGuid();

        // Should not throw.
        await dispatcher.DispatchAsync(workspaceId, "sprint.started", new { sprintId = Guid.NewGuid() });
    }

    [Fact]
    public async Task DispatchAsync_NoMatchingWebhooks_IsNoOp()
    {
        var handler = new StubHttpMessageHandler(HttpStatusCode.OK);
        var dispatcher = new WebhookDispatcher(
            StubWebhooks(Webhook.Create(Guid.NewGuid(), "https://example.com/hook", ["task.updated"], null)),
            StubHttpClient(handler));

        var workspaceId = Guid.NewGuid();

        await dispatcher.DispatchAsync(workspaceId, "sprint.started", new { sprintId = Guid.NewGuid() });

        Assert.Equal(0, handler.RequestCount);
    }

    private sealed class StubHttpMessageHandler : HttpMessageHandler
    {
        private readonly HttpResponseMessage? _response;
        private readonly Exception? _exception;

        public StubHttpMessageHandler(HttpStatusCode statusCode)
        {
            _response = new HttpResponseMessage(statusCode);
        }

        public StubHttpMessageHandler(Exception exception)
        {
            _exception = exception;
        }

        public int RequestCount { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            RequestCount++;

            if (_exception is not null)
            {
                throw _exception;
            }

            return Task.FromResult(_response!);
        }
    }
}
