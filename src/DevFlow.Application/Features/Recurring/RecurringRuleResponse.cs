using DevFlow.Domain.Entities;

namespace DevFlow.Application.Features.Recurring;

public sealed record RecurringRuleResponse(
    Guid Id,
    Guid ProjectId,
    string Title,
    string? Description,
    string Priority,
    string Frequency,
    int Interval,
    DateTimeOffset FirstDueDateUtc,
    DateTimeOffset NextOccurrenceUtc,
    bool IsActive,
    Guid? SeedTaskId);

public static class RecurringRuleMappings
{
    public static RecurringRuleResponse ToResponse(this RecurringTaskRule rule) =>
        new(
            rule.Id,
            rule.ProjectId,
            rule.Title,
            rule.Description,
            rule.Priority.ToString(),
            rule.Frequency.ToString(),
            rule.Interval,
            rule.FirstDueDateUtc,
            rule.NextOccurrenceUtc,
            rule.IsActive,
            rule.SeedTaskId);
}
