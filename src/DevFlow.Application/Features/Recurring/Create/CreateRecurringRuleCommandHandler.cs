using DevFlow.Application.Common.Authorization;
using DevFlow.Application.Common.Exceptions;
using DevFlow.Application.Common.Interfaces;
using DevFlow.Domain.Entities;
using MediatR;

namespace DevFlow.Application.Features.Recurring.Create;

public sealed class CreateRecurringRuleCommandHandler(
    IProjectRepository projectRepository,
    IRecurringTaskRuleRepository ruleRepository,
    IUserContext userContext,
    IUnitOfWork unitOfWork) : IRequestHandler<CreateRecurringRuleCommand, RecurringRuleResponse>
{
    public async Task<RecurringRuleResponse> Handle(
        CreateRecurringRuleCommand command,
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

        var rule = RecurringTaskRule.Create(
            command.ProjectId,
            command.Title,
            command.Description,
            command.Priority,
            command.Frequency,
            command.Interval,
            command.FirstDueDateUtc,
            userContext.UserId,
            command.SeedTaskId);

        await ruleRepository.AddAsync(rule, cancellationToken);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        return rule.ToResponse();
    }
}
