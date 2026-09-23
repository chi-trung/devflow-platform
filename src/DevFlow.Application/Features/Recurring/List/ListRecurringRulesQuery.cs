using DevFlow.Application.Common.Authorization;
using DevFlow.Domain.Enums;
using MediatR;

namespace DevFlow.Application.Features.Recurring.List;

[RequireWorkspaceRole(WorkspaceRole.Member)]
public sealed record ListRecurringRulesQuery(Guid WorkspaceId, Guid ProjectId)
    : IRequest<IReadOnlyList<RecurringRuleResponse>>, IWorkspaceRequest;
