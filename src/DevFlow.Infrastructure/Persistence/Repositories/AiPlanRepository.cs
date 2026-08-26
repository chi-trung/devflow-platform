using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace DevFlow.Infrastructure.Persistence.Repositories;

public sealed class AiPlanRepository(DevFlowDbContext dbContext) : IAiPlanRepository
{
    public async Task AddAsync(AiPlan plan, CancellationToken cancellationToken = default)
    {
        await dbContext.AiPlans.AddAsync(plan, cancellationToken);
    }

    public Task<AiPlan?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        return dbContext.AiPlans.FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
    }

    public Task<AiPlan?> GetLatestForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        return dbContext.AiPlans
            .Where(p => p.TaskId == taskId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .FirstOrDefaultAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AiPlan>> GetForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        var plans = await dbContext.AiPlans
            .AsNoTracking()
            .Where(p => p.TaskId == taskId)
            .OrderByDescending(p => p.CreatedAtUtc)
            .ToListAsync(cancellationToken);

        return plans;
    }

    public async Task<IReadOnlyList<AiPlan>> GetPendingForTaskAsync(Guid taskId, CancellationToken cancellationToken = default)
    {
        var plans = await dbContext.AiPlans
            .Where(p => p.TaskId == taskId && p.Status == Domain.Enums.AiPlanStatus.Pending)
            .ToListAsync(cancellationToken);

        return plans;
    }
}