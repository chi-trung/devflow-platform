using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class Project : BaseEntity, IAuditableEntity, ISoftDeletable
{
    private Project()
    {
    }

    private Project(Guid workspaceId, string name, string key, string? description)
    {
        WorkspaceId = workspaceId;
        Name = name;
        Key = key;
        Description = description;
    }

    public Guid WorkspaceId { get; private set; }

    public string Name { get; private set; } = string.Empty;

    public string Key { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public ProjectStatus Status { get; private set; } = ProjectStatus.Active;

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public DateTimeOffset? DeletedAtUtc { get; set; }

    public static Project Create(Guid workspaceId, string name, string key, string? description)
    {
        if (workspaceId == Guid.Empty)
        {
            throw new ArgumentException("Workspace id is required.", nameof(workspaceId));
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(key))
        {
            throw new ArgumentException("Key is required.", nameof(key));
        }

        return new Project(workspaceId, name.Trim(), key.Trim().ToUpperInvariant(), description?.Trim());
    }

    public void UpdateDetails(string name, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        Name = name.Trim();
        Description = description?.Trim();
    }

    public void Archive()
    {
        Status = ProjectStatus.Archived;
        DeletedAtUtc = DateTimeOffset.UtcNow;
    }

    public void Restore()
    {
        Status = ProjectStatus.Active;
        DeletedAtUtc = null;
    }
}
