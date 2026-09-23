using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Spawn;

public sealed class SpawnRecurringTaskCommandHandler(
    IProjectRepository projectRepository,
    IRecurringTaskRuleRepository ruleRepository,
    ITaskItemRepository taskItemRepository,
    IActivityLogRepository activityLogRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<SpawnRecurringTaskCommand, Guid?>
{
    private const int MaxSaveAttempts = 3;

    public async Task<Guid?> Handle(
        SpawnRecurringTaskCommand command,
        CancellationToken cancellationToken)
    {
        // Soft-deleted rules are filtered out of GetDueAsync, but a pause or
        // concurrent delete between the poll and this command is a clean miss.
        var rule = await ruleRepository.GetByIdAsync(command.RuleId, cancellationToken);
        if (rule is null
            || !rule.IsActive
            || rule.ProjectId != command.ProjectId
            || rule.NextOccurrenceUtc != command.ExpectedOccurrenceUtc)
        {
            // CAS miss: another worker already spawned (or advanced) this
            // occurrence — return null so the processor does not retry.
            return null;
        }

        // Project must still exist for activity-log workspace pinning; a
        // cascade should have removed the rule, so this is belt-and-braces.
        var project = await projectRepository.GetByIdAsync(rule.ProjectId, cancellationToken);
        if (project is null)
        {
            return null;
        }

        // Claim the cursor BEFORE minting so a mid-handler failure cannot
        // leave NextOccurrenceUtc stuck and re-fire forever. If the subsequent
        // SaveChanges rolls back (unique race exhausted), the whole unit of
        // work including the claim is discarded together.
        if (!rule.TryAdvanceFrom(command.ExpectedOccurrenceUtc))
        {
            return null;
        }

        var task = TaskItem.Create(
            rule.ProjectId,
            rule.Title,
            rule.Description,
            rule.Priority);
        task.SetDueDate(command.ExpectedOccurrenceUtc);
        task.SetNumber(await taskItemRepository.GetMaxNumberAsync(rule.ProjectId, cancellationToken) + 1);

        await taskItemRepository.AddAsync(task, cancellationToken);

        // Actor = rule creator (not HTTP user — there is none in the processor).
        await activityLogRepository.AddAsync(
            ActivityLog.Create(
                project.WorkspaceId,
                rule.ProjectId,
                task.Id,
                rule.CreatedByUserId,
                "created task",
                task.Title),
            cancellationToken);

        for (var attempt = 1; ; attempt++)
        {
            try
            {
                await unitOfWork.SaveChangesAsync(cancellationToken);
                break;
            }
            catch (Exception ex) when (
                attempt < MaxSaveAttempts &&
                IsUniqueViolation(ex))
            {
                // (project_id, number) race: re-query Max and mint again.
                // The rule claim above is already applied in-memory and will
                // be written with this retried SaveChanges.
                task.SetNumber(await taskItemRepository.GetMaxNumberAsync(rule.ProjectId, cancellationToken) + 1);
            }
        }

        return task.Id;
    }

    private static bool IsUniqueViolation(Exception ex)
    {
        // Same string-match contract as CreateTaskItemCommandHandler: Npgsql
        // embeds SQLSTATE 23505 without requiring an EF reference here.
        return ex.Message.Contains("23505", StringComparison.Ordinal) ||
               ex.InnerException?.Message.Contains("23505", StringComparison.Ordinal) == true;
    }
}
