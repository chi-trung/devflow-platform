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
            try
            {
                var content = new StringContent(body, Encoding.UTF8, "application/json");

                if (!string.IsNullOrEmpty(webhook.Secret))
                {
                    var signature = ComputeHmac(body, webhook.Secret);
                    content.Headers.Add("X-Webhook-Signature", signature);
                }

                content.Headers.Add("X-Webhook-Event", eventName);

                await client.PostAsync(webhook.Url, content, cancellationToken);
            }
            catch
            {
                // Fire-and-forget — webhook failures shouldn't break the app
            }
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
