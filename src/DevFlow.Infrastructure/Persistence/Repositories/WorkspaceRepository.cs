using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class WorkspaceRepository(DevFlowDbContext dbContext) : IWorkspaceRepository
{
    public Task<bool> ExistsBySlugAsync(string slug, CancellationToken cancellationToken = default)
    {
        return dbContext.Workspaces.AnyAsync(workspace => workspace.Slug == slug, cancellationToken);
    }

    public Task<Workspace?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.Workspaces.FirstOrDefaultAsync(workspace => workspace.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<(Workspace Workspace, WorkspaceRole Role)>> GetForUserAsync(
        Guid userId, CancellationToken cancellationToken = default)
    {
        var rows = await dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member => member.UserId == userId)
            .Join(
                dbContext.Workspaces,
                member => member.WorkspaceId,
                workspace => workspace.Id,
                (member, workspace) => new { Workspace = workspace, member.Role })
            .ToListAsync(cancellationToken);

        return rows.Select(row => (row.Workspace, row.Role)).ToList();
    }

    public async Task<IReadOnlyList<(Guid UserId, string Email, string Username, string DisplayName, WorkspaceRole Role)>>
        GetMembersAsync(Guid workspaceId, CancellationToken cancellationToken = default)
    {
        var rows = await dbContext.WorkspaceMembers
            .AsNoTracking()
            .Where(member => member.WorkspaceId == workspaceId)
            .Join(
                dbContext.Users,
                member => member.UserId,
                user => user.Id,
                (member, user) => new
                {
                    member.UserId,
                    user.Email,
                    user.Username,
                    user.DisplayName,
                    member.Role
                })
            .OrderBy(row => row.Role)
            .ToListAsync(cancellationToken);

        return rows.Select(row =>
            (row.UserId, row.Email, row.Username, row.DisplayName, row.Role)).ToList();
    }

    public Task<WorkspaceRole?> GetMemberRoleAsync(
        Guid workspaceId, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.WorkspaceMembers
            .Where(member => member.WorkspaceId == workspaceId && member.UserId == userId)
            .Select(member => (WorkspaceRole?)member.Role)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(Workspace workspace, CancellationToken cancellationToken = default)
    {
        await dbContext.Workspaces.AddAsync(workspace, cancellationToken);
    }

    public async Task AddMemberAsync(
        Workspace workspace,
        Guid userId,
        WorkspaceRole role,
        CancellationToken cancellationToken = default)
    {
        var member = workspace.AddMember(userId, role);

        await dbContext.WorkspaceMembers.AddAsync(member, cancellationToken);
    }

    public async Task RemoveMemberAsync(Guid workspaceId, Guid userId, CancellationToken cancellationToken = default)
    {
        var member = await dbContext.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId, cancellationToken);

        if (member is not null)
        {
            dbContext.WorkspaceMembers.Remove(member);
        }
    }

    public async Task UpdateMemberRoleAsync(Guid workspaceId, Guid userId, WorkspaceRole newRole, CancellationToken cancellationToken = default)
    {
        var member = await dbContext.WorkspaceMembers
            .FirstOrDefaultAsync(m => m.WorkspaceId == workspaceId && m.UserId == userId, cancellationToken);

        if (member is not null)
        {
            member.UpdateRole(newRole);
        }
    }

    public void Delete(Workspace workspace)
    {
        dbContext.Workspaces.Remove(workspace);
    }
}
