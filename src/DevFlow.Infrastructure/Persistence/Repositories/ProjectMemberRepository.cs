using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class ProjectMemberRepository(DevFlowDbContext dbContext) : IProjectMemberRepository
{
    public async Task<IReadOnlyList<ProjectMember>> GetByProjectAsync(
        Guid projectId, CancellationToken cancellationToken = default)
    {
        var members = await dbContext.ProjectMembers
            .AsNoTracking()
            .Where(member => member.ProjectId == projectId)
            .OrderBy(member => member.Role)
            .ToListAsync(cancellationToken);

        return members;
    }

    public async Task<IReadOnlyList<ProjectMember>> GetByUserInWorkspaceAsync(
        Guid workspaceId, Guid userId, CancellationToken cancellationToken = default)
    {
        var members = await dbContext.ProjectMembers
            .AsNoTracking()
            .Where(member => member.UserId == userId)
            .Join(
                dbContext.Projects,
                member => member.ProjectId,
                project => project.Id,
                (member, project) => new { Member = member, project.WorkspaceId })
            .Where(row => row.WorkspaceId == workspaceId)
            .Select(row => row.Member)
            .ToListAsync(cancellationToken);

        return members;
    }

    public Task<ProjectMember?> GetAsync(
        Guid projectId, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.ProjectMembers
            .FirstOrDefaultAsync(member => member.ProjectId == projectId && member.UserId == userId, cancellationToken);
    }

    public Task<bool> ExistsAsync(
        Guid projectId, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.ProjectMembers
            .AnyAsync(member => member.ProjectId == projectId && member.UserId == userId, cancellationToken);
    }

    public Task<ProjectRole?> GetRoleAsync(
        Guid projectId, Guid userId, CancellationToken cancellationToken = default)
    {
        return dbContext.ProjectMembers
            .Where(member => member.ProjectId == projectId && member.UserId == userId)
            .Select(member => (ProjectRole?)member.Role)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task AddAsync(ProjectMember member, CancellationToken cancellationToken = default)
    {
        await dbContext.ProjectMembers.AddAsync(member, cancellationToken);
    }

    public async Task RemoveAsync(Guid projectId, Guid userId, CancellationToken cancellationToken = default)
    {
        var member = await dbContext.ProjectMembers
            .FirstOrDefaultAsync(m => m.ProjectId == projectId && m.UserId == userId, cancellationToken);

        if (member is not null)
        {
            dbContext.ProjectMembers.Remove(member);
        }
    }
}
