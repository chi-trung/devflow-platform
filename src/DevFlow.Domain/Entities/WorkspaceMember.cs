using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class WorkspaceMember : BaseEntity, IAuditableEntity
{
    private WorkspaceMember()
    {
    }

    private WorkspaceMember(Guid workspaceId, Guid userId, WorkspaceRole role)
    {
        WorkspaceId = workspaceId;
        UserId = userId;
        Role = role;
    }

    public Guid WorkspaceId { get; private set; }

    public Guid UserId { get; private set; }

    public WorkspaceRole Role { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static WorkspaceMember Create(Guid workspaceId, Guid userId, WorkspaceRole role)
    {
        if (workspaceId == Guid.Empty)
        {
            throw new ArgumentException("Workspace id is required.", nameof(workspaceId));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        return new WorkspaceMember(workspaceId, userId, role);
    }
}
