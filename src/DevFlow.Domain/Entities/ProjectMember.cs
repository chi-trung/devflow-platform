using DevFlow.Domain.Common;
using DevFlow.Domain.Enums;

namespace DevFlow.Domain.Entities;

public class ProjectMember : BaseEntity, IAuditableEntity
{
    private ProjectMember()
    {
    }

    private ProjectMember(Guid projectId, Guid userId, ProjectRole role)
    {
        ProjectId = projectId;
        UserId = userId;
        Role = role;
    }

    public Guid ProjectId { get; private set; }

    public Guid UserId { get; private set; }

    public ProjectRole Role { get; private set; }

    public DateTimeOffset CreatedAtUtc { get; set; }

    public DateTimeOffset? UpdatedAtUtc { get; set; }

    public static ProjectMember Create(Guid projectId, Guid userId, ProjectRole role)
    {
        if (projectId == Guid.Empty)
        {
            throw new ArgumentException("Project id is required.", nameof(projectId));
        }

        if (userId == Guid.Empty)
        {
            throw new ArgumentException("User id is required.", nameof(userId));
        }

        return new ProjectMember(projectId, userId, role);
    }

    public void UpdateRole(ProjectRole role)
    {
        Role = role;
    }
}
