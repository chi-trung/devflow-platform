using System.Collections.Concurrent;
using System.Security.Cryptography;

namespace DevFlow.Api.Auth;

/// <summary>
/// Single-purpose, single-use credentials for SignalR hub connections. The
/// browser exchanges its long-lived JWT for a short-lived opaque ticket via
/// <c>POST /api/v1/auth/hub-ticket</c> (Authorization header) and passes the
/// ticket in the WebSocket query string — so proxies never log a reusable
/// access token, only a value that is dead after one handshake and 90s.
/// Tickets are held in-process: fine for a single API instance (Render free
/// tier is 1:1), and a restart simply invalidates outstanding tickets, at
/// which point clients reconnect with a fresh one.
/// </summary>
public sealed class HubTicketStore
{
    private const int TicketLifetimeSeconds = 90;
    private const int MaxEntries = 10_000; // abuse ceiling; prune-on-insert

    private readonly ConcurrentDictionary<string, Entry> _tickets = new();

    private sealed record Entry(string UserId, DateTime ExpiresAtUtc);

    public static string Prefix => "hbt_";

    /// <summary>Mints a one-time ticket bound to the authenticated user id.</summary>
    public string Issue(string userId)
    {
        Prune();
        // 32 random bytes → 43 chars base64url; opaque, unguessable.
        var bytes = RandomNumberGenerator.GetBytes(32);
        var ticket = Prefix + Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');

        _tickets[ticket] = new Entry(
            userId,
            DateTime.UtcNow.AddSeconds(TicketLifetimeSeconds));

        return ticket;
    }

    /// <summary>
    /// Redeems a ticket: valid (known, unexpired, first use) returns the user
    /// id and burns the ticket; anything else returns null.
    /// </summary>
    public string? Redeem(string? ticket)
    {
        if (string.IsNullOrEmpty(ticket) || !ticket.StartsWith(Prefix, StringComparison.Ordinal))
            return null;

        if (!_tickets.TryRemove(ticket, out var entry)) return null; // single use

        if (DateTime.UtcNow > entry.ExpiresAtUtc) return null; // expired

        return entry.UserId;
    }

    private void Prune()
    {
        if (_tickets.Count < MaxEntries / 2) return;

        var now = DateTime.UtcNow;
        foreach (var (ticket, entry) in _tickets)
        {
            if (now > entry.ExpiresAtUtc) _tickets.TryRemove(ticket, out _);
        }

        // Still full after pruning expired entries: drop everything, forcing
        // clients to re-authenticate. Cheaper than unbounded growth.
        if (_tickets.Count >= MaxEntries)
        {
            _tickets.Clear();
        }
    }
}
