using DevFlow.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;

namespace DevFlow.Infrastructure.Persistence.Interceptors;

/// <summary>
/// Converts hard deletes on soft-deletable entities into soft deletes by
/// setting DeletedAtUtc and flipping the entity state to Modified. Combined
/// with the global query filter, deleted rows disappear from reads but stay
/// recoverable in the database.
/// </summary>
public sealed class SoftDeleteInterceptor : SaveChangesInterceptor
{
    public override InterceptionResult<int> SavingChanges(
        DbContextEventData eventData,
        InterceptionResult<int> result)
    {
        ApplySoftDeletes(eventData);
        return base.SavingChanges(eventData, result);
    }

    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData eventData,
        InterceptionResult<int> result,
        CancellationToken cancellationToken = default)
    {
        ApplySoftDeletes(eventData);
        return base.SavingChangesAsync(eventData, result, cancellationToken);
    }

    private static void ApplySoftDeletes(DbContextEventData eventData)
    {
        if (eventData.Context is null) return;

        var utcNow = DateTimeOffset.UtcNow;

        foreach (var entry in eventData.Context.ChangeTracker.Entries<ISoftDeletable>())
        {
            if (entry.State != EntityState.Deleted) continue;

            entry.State = EntityState.Modified;
            entry.Entity.DeletedAtUtc = utcNow;
        }
    }
}
