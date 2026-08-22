using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class Webhook : BaseEntity, IAuditableEntity
{
    private Webhook() { }

    private Webhook(Guid workspaceId, string url, string[] events)
    {
        WorkspaceId = workspaceId;
        Url = url;
        Events = events;
    }

    public Guid WorkspaceId { get; private set; }
    public string Url { get; private set; } = string.Empty;
    public string[] Events { get; private set; } = [];
    public bool IsActive { get; private set; } = true;
    public string? Secret { get; private set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static Webhook Create(Guid workspaceId, string url, string[] events, string? secret = null)
    {
        if (string.IsNullOrWhiteSpace(url))
            throw new ArgumentException("URL is required.", nameof(url));

        if (events.Length == 0)
            throw new ArgumentException("At least one event is required.", nameof(events));

        return new Webhook(workspaceId, url, events) { Secret = secret };
    }

    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
