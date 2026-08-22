using DevFlow.Domain.Common;

namespace DevFlow.Domain.Entities;

public class SavedSearch : BaseEntity, IAuditableEntity
{
    private SavedSearch() { }

    public Guid UserId { get; private set; }
    public Guid WorkspaceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string Query { get; set; } = string.Empty;
    public string? FiltersJson { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static SavedSearch Create(Guid userId, Guid workspaceId, string name)
    {
        return new SavedSearch
        {
            UserId = userId,
            WorkspaceId = workspaceId,
            Name = name,
        };
    }
}
