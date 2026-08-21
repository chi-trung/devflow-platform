using FluentValidation;

namespace DevFlow.Application.Features.Projects.Create;

public sealed class CreateProjectCommandValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectCommandValidator()
    {
        RuleFor(command => command.WorkspaceId)
            .NotEmpty();

        RuleFor(command => command.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(command => command.Key)
            .NotEmpty()
            .MinimumLength(2)
            .MaximumLength(10)
            .Matches("^[A-Za-z][A-Za-z0-9]+$")
            .WithMessage("Key must start with a letter and contain only letters and digits.");

        RuleFor(command => command.Description)
            .MaximumLength(500);
    }
}
