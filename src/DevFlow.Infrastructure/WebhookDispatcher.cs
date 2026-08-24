using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using DevFlow.Application.Common.Interfaces;
using Microsoft.Extensions.Http;

namespace DevFlow.Infrastructure;

public sealed class WebhookDispatcher(
    IWebhookRepository webhookRepository,
    IHttpClientFactory httpClientFactory) : IWebhookDispatcher
{
    public async Task DispatchAsync(Guid workspaceId, string eventName, object payload, CancellationToken cancellationToken = default)
    {
        var webhooks = await webhookRepository.GetByWorkspaceIdAsync(workspaceId, cancellationToken);
        var matching = webhooks.Where(w => w.Events.Contains(eventName)).ToList();

        if (matching.Count == 0) return;

        var client = httpClientFactory.CreateClient("Webhooks");
        var body = JsonSerializer.Serialize(new
        {
            event_name = eventName,
            timestamp = DateTimeOffset.UtcNow,
            data = payload,
        });

        foreach (var webhook in matching)
        {
            var content = new StringContent(body, Encoding.UTF8, "application/json");

            if (!string.IsNullOrEmpty(webhook.Secret))
            {
                var signature = ComputeHmac(body, webhook.Secret);
                content.Headers.Add("X-Webhook-Signature", signature);
            }

            content.Headers.Add("X-Webhook-Event", eventName);

            // Do NOT swallow delivery failures here — let exceptions propagate up to
            // OutboxProcessor.ProcessMessageAsync, which applies exponential backoff
            // retries and dead-letters the message once RetryCount hits MaxRetries.
            // The previous `catch {}` caused every webhook to be marked processed
            // even when the delivery failed, so the DLQ was never populated.
            var response = await client.PostAsync(webhook.Url, content, cancellationToken);
            response.EnsureSuccessStatusCode();
        }
    }

    private static string ComputeHmac(string body, string secret)
    {
        var keyBytes = Encoding.UTF8.GetBytes(secret);
        var bodyBytes = Encoding.UTF8.GetBytes(body);
        using var hmac = new HMACSHA256(keyBytes);
        var hash = hmac.ComputeHash(bodyBytes);
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}
