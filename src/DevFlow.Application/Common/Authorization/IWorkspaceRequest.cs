using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Authorization;

/// <summary>
/// Implemented by requests that operate inside a workspace and require
/// the current user to hold at least the role declared by
/// <see cref="RequireWorkspaceRoleAttribute"/>.
/// </summary>
public interface IWorkspaceRequest
{
    Guid WorkspaceId { get; }
}

[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public sealed class RequireWorkspaceRoleAttribute : Attribute
{
    public RequireWorkspaceRoleAttribute(WorkspaceRole minimumRole)
    {
        MinimumRole = minimumRole;
    }

    public WorkspaceRole MinimumRole { get; }
}
