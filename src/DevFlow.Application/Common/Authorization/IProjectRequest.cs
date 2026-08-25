using DevFlow.Domain.Enums;

namespace DevFlow.Application.Common.Authorization;

/// <summary>
/// Implemented by requests that operate inside a project and optionally require
/// a project-level role via <see cref="RequireProjectRoleAttribute"/>.
/// The workspace authorization check still applies; project-role checks layer
/// on top when the user is an explicit project member.
/// </summary>
public interface IProjectRequest : IWorkspaceRequest
{
    Guid ProjectId { get; }
}

[AttributeUsage(AttributeTargets.Class, AllowMultiple = false)]
public sealed class RequireProjectRoleAttribute : Attribute
{
    public RequireProjectRoleAttribute(ProjectRole minimumRole)
    {
        MinimumRole = minimumRole;
    }

    public ProjectRole MinimumRole { get; }
}
