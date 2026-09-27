using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;

namespace DevFlow.Application.Features.Tasks;

/// <summary>
/// Assigns a task's per-project sequence number, which backs the
/// "{Project.Key}-{Number}" key a person reads. <c>Number</c> is non-nullable
/// and unique per project, so leaving it at the CLR default makes every row that
/// skipped this share the number 0 — and the second one fails to insert.
/// </summary>
public static class TaskNumberAssigner
{
    private const int MaxSaveAttempts = 3;

    /// <summary>
    /// Persists a newly added task, re-deriving its number if another row took
    /// it in the meantime. Two people creating tasks at the same moment both
    /// compute Max+1; the (project_id, number) unique index is the source of
    /// truth, so a collision is retried a bounded number of times rather than
    /// surfaced as a 500.
    /// </summary>
    public static async Task SaveWithNumberAsync(
        TaskItem task,
        ITaskItemRepository taskItemRepository,
        IUnitOfWork unitOfWork,
        Guid projectId,
        CancellationToken cancellationToken)
    {
        task.SetNumber(await taskItemRepository.GetMaxNumberAsync(projectId, cancellationToken) + 1);

        await taskItemRepository.AddAsync(task, cancellationToken);

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
                return;
            }
            catch (Exception ex) when (
                attempt < MaxSaveAttempts &&
                IsUniqueViolation(ex))
            {
                task.SetNumber(await taskItemRepository.GetMaxNumberAsync(projectId, cancellationToken) + 1);
            }
        }
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        // Npgsql embeds the Postgres SQLSTATE (23505 = unique_violation) in the
        // exception text. Matched as a string so the Application layer needs no
        // EF Core reference. Any unique violation here is safe to retry — the
        // only concurrent-insert-prone index on task_items is
        // (project_id, number).
        return ex.Message.Contains("23505", StringComparison.Ordinal) ||
               ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true;
    }
}
