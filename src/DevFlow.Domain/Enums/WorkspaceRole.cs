namespace DevFlow.Domain.Enums;

/// <summary>
/// Ordered by privilege level — higher values grant more permissions.
/// </summary>
public enum WorkspaceRole
{
    Member = 0,
    Admin = 1,
    Owner = 2
}
