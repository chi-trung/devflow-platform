using FluentValidation;

namespace DevFlow.Application.Features.Sprints.Create;

public sealed class CreateSprintCommandValidator : AbstractValidator<CreateSprintCommand>
{
    public CreateSprintCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.ProjectId)
            .NotEmpty();

        RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(command => command.Goal)
            .MaximumLength(500);
    }
}
