using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;
// WorkspaceRole lives in Domain.Enums (same as CreateSprintCommand).

namespace DevFlow.Application.Features.Recurring.Create;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record CreateRecurringRuleCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    string Title,
    string? Description,
    TaskItemPriority Priority,
    RecurrenceFrequency Frequency,
    int Interval,
    DateTimeOffset FirstDueDateUtc,
    Guid? SeedTaskId = null) : IRequest<RecurringRuleResponse>, IWorkspaceRequest, IProjectEvent
{
    // Empty verb: ActivityBehavior would need IUserContext (HTTP). The
    // created-by actor is stamped on the rule itself for later spawns.
    public string ActivityVerb => "";
    public string ActivityLabel => Title;
    public Guid? ActivityTaskId => null;
}
