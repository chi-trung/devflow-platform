using FluentValidation;

namespace DevFlow.Application.Features.Recurring.Create;

public sealed class CreateRecurringRuleCommandValidator : AbstractValidator<CreateRecurringRuleCommand>
{
    public CreateRecurringRuleCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.Title)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(command => command.Description)
            .MaximumLength(5000);

        RuleFor(command => command.Interval)
            .InclusiveBetween(1, 365);

        RuleFor(command => command.Frequency)
            .IsInEnum();

        RuleFor(command => command.Priority)
            .IsInEnum();
    }
}
