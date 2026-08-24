using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class Workspace : BaseEntity, IAuditableEntity
{
    private readonly List<WorkspaceMember> _members = [];

    private Workspace()
    {
    }

    private Workspace(string name, string slug, string? description)
    {
        Name = name;
        Slug = slug;
        Description = description;
    }

    public string Name { get; private set; } = string.Empty;

    public string Slug { get; private set; } = string.Empty;

    public string? Description { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public IReadOnlyCollection<WorkspaceMember> Members => _members.AsReadOnly();

    public static Workspace Create(string name, string slug, string? description)
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException("Name is required.", nameof(name));
        }

        if (string.IsNullOrWhiteSpace(slug))
        {
            throw new ArgumentException("Slug is required.", nameof(slug));
        }

        return new Workspace(name.Trim(), slug.Trim().ToLowerInvariant(), description?.Trim());
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

    public WorkspaceMember AddMember(Guid userId, WorkspaceRole role)
    {
        if (_members.Any(member => member.UserId == userId))
        {
            throw new InvalidOperationException($"User {userId} is already a member of this workspace.");
        }

        var member = WorkspaceMember.Create(Id, userId, role);
        _members.Add(member);

        return member;
    }
}
