using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Update;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record UpdateRecurringRuleCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid RuleId,
    string Title,
    string? Description,
    TaskItemPriority Priority,
    RecurrenceFrequency Frequency,
    int Interval,
    DateTimeOffset FirstDueDateUtc,
    bool IsActive) : IRequest<RecurringRuleResponse>, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "";
    public string ActivityLabel => Title;
    public Guid? ActivityTaskId => null;
}
