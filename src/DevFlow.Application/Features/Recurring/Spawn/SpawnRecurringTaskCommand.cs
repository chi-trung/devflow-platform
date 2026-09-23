using DevFlow.Application.Common.Behaviors;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Spawn;

/// <summary>
/// Headless mint of one TaskItem for a due recurring rule. Deliberately NOT
/// <c>IWorkspaceRequest</c>: WorkspaceAuthorizationBehavior would read
/// IUserContext.UserId and throw Unauthorized from the background processor
/// (no HTTP context). Empty ActivityVerb keeps ActivityBehavior from touching
/// IUserContext as well — the handler writes the activity row itself with
/// the rule's CreatedByUserId as actor.
/// </summary>
public sealed record SpawnRecurringTaskCommand(
    Guid ProjectId,
    Guid RuleId,
    DateTimeOffset ExpectedOccurrenceUtc) : IRequest<Guid?>, IProjectEvent
{
    public string ActivityVerb => "";
    public string ActivityLabel => "";
    public Guid? ActivityTaskId => null;
}
