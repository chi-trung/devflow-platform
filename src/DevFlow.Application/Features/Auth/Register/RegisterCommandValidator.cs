using FluentValidation;

namespace DevFlow.Application.Features.Auth.Register;

public sealed class RegisterCommandValidator : AbstractValidator<RegisterCommand>
{
    public RegisterCommandValidator()
    {
        RuleFor(command => command.Email)
            .NotEmpty()
            .MaximumLength(255)
            .EmailAddress();

        RuleFor(command => command.Username)
            .NotEmpty()
            .MinimumLength(3)
            .MaximumLength(50)
            .Matches("^[a-zA-Z0-9_]+$")
            .WithMessage("Username may only contain letters, digits and underscores.");

        RuleFor(command => command.Password)
            .NotEmpty()
            .MinimumLength(8)
            .MaximumLength(128);

        RuleFor(command => command.DisplayName)
            .NotEmpty()
            .MaximumLength(100);
    }
}
