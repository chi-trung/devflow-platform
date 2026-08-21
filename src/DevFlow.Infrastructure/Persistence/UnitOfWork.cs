using DevFlow.Application.Common.Interfaces;
using DevFlow.Infrastructure.Persistence;

namespace DevFlow.Infrastructure.Persistence;

public sealed class UnitOfWork(DevFlowDbContext dbContext) : IUnitOfWork
{
    public Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return dbContext.SaveChangesAsync(cancellationToken);
    }
}
