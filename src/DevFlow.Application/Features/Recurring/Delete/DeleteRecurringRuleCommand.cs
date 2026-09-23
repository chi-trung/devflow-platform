using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Behaviors;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Delete;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record DeleteRecurringRuleCommand(
    Guid WorkspaceId,
    Guid ProjectId,
    Guid RuleId) : IRequest, IWorkspaceRequest, IProjectEvent
{
    public string ActivityVerb => "";
    public string ActivityLabel => RuleId.ToString();
    public Guid? ActivityTaskId => null;
}
