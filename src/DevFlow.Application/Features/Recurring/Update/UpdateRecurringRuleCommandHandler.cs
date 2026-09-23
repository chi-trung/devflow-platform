using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Update;

public sealed class UpdateRecurringRuleCommandHandler(
    IProjectRepository projectRepository,
    IRecurringTaskRuleRepository ruleRepository,
    IUnitOfWork unitOfWork) : IRequestHandler<UpdateRecurringRuleCommand, RecurringRuleResponse>
{
    public async Task<RecurringRuleResponse> Handle(
        UpdateRecurringRuleCommand command,
        CancellationToken cancellationToken)
    {
        if (command.Interval < 1)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["interval"] = ["Interval must be at least 1."],
            });
        }

        if (string.IsNullOrWhiteSpace(command.Title) || command.Title.Length > 200)
        {
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["title"] = ["Title is required and must be at most 200 characters."],
            });
        }

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

        // Entity recomputes NextOccurrenceUtc only when cadence changed while active.
        rule.Update(
            command.Title,
            command.Description,
            command.Priority,
            command.Frequency,
            command.Interval,
            command.FirstDueDateUtc,
            command.IsActive);

        await unitOfWork.SaveChangesAsync(cancellationToken);

        return rule.ToResponse();
    }
}
