using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Delete;

public sealed class DeleteRecurringRuleCommandHandler(
    IProjectRepository projectRepository,
    IRecurringTaskRuleRepository ruleRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<DeleteRecurringRuleCommand>
{
    public async Task Handle(DeleteRecurringRuleCommand command, CancellationToken cancellationToken)
    {
        var project = await projectRepository.GetByIdAsync(command.ProjectId, cancellationToken);
        if (project is null || project.WorkspaceId != command.WorkspaceId)
        {
            throw new NotFoundException(nameof(Project), command.ProjectId);
        }

        var rule = await ruleRepository.GetByIdAsync(command.RuleId, cancellationToken);
        if (rule is null || rule.ProjectId != command.ProjectId)
        {
            throw new NotFoundException(nameof(RecurringTaskRule), command.RuleId);
        }

        // SoftDeleteInterceptor turns Remove into DeletedAtUtc = now so past
        // spawned tasks keep their provenance if we ever restore the rule.
        await ruleRepository.RemoveAsync(rule, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
