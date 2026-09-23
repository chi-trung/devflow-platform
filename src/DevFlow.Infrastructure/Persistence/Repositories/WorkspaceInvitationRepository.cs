using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using DevFlow.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class WorkspaceInvitationRepository(DevFlowDbContext dbContext) : IWorkspaceInvitationRepository
{
    public async Task AddAsync(WorkspaceInvitation invitation, CancellationToken cancellationToken = default)
    {
        await dbContext.Set<WorkspaceInvitation>().AddAsync(invitation, cancellationToken);
    }

    public async Task<WorkspaceInvitation?> GetPendingAsync(
        Guid workspaceId,
        Guid invitedUserId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Set<WorkspaceInvitation>()
            .AsNoTracking()
            .FirstOrDefaultAsync(
                i => i.WorkspaceId == workspaceId
                    && i.InvitedUserId == invitedUserId
                    && i.Status == InvitationStatus.Pending,
                cancellationToken);
    }

    public async Task<WorkspaceInvitation?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        // Tracked: Accept/Decline/Revoke mutate Status and must hit SaveChanges.
        return await dbContext.Set<WorkspaceInvitation>()
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);
    }

    public async Task<IReadOnlyList<WorkspaceInvitation>> ListPendingForWorkspaceAsync(
        Guid workspaceId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Set<WorkspaceInvitation>()
            .AsNoTracking()
            .Where(i => i.WorkspaceId == workspaceId && i.Status == InvitationStatus.Pending)
            .OrderByDescending(i => i.InvitedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<WorkspaceInvitation>> ListPendingForUserAsync(
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Set<WorkspaceInvitation>()
            .AsNoTracking()
            .Where(i => i.InvitedUserId == userId && i.Status == InvitationStatus.Pending)
            .OrderByDescending(i => i.InvitedAtUtc)
            .ToListAsync(cancellationToken);
    }

    public async Task<bool> HasPendingForUserInWorkspaceAsync(
        Guid workspaceId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        return await dbContext.Set<WorkspaceInvitation>()
            .AsNoTracking()
            .AnyAsync(
                i => i.WorkspaceId == workspaceId
                    && i.InvitedUserId == userId
                    && i.Status == InvitationStatus.Pending,
                cancellationToken);
    }
}
