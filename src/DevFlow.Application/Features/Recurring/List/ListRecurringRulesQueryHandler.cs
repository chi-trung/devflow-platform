using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Recurring.List;

public sealed class ListRecurringRulesQueryHandler(
    IProjectRepository projectRepository,
    IRecurringTaskRuleRepository ruleRepository) : IRequestHandler<ListRecurringRulesQuery, IReadOnlyList<RecurringRuleResponse>>
{
    public async Task<IReadOnlyList<RecurringRuleResponse>> Handle(
        ListRecurringRulesQuery query,
        CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(query.ProjectId, cancellationToken);
        if (project is null || project.WorkspaceId != query.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), query.ProjectId);
        }

        var rules = await ruleRepository.GetByProjectIdAsync(query.ProjectId, cancellationToken);
        return rules.Select(rule => rule.ToResponse()).ToList();
    }
}
