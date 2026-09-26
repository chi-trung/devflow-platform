using FluentValidation;

namespace DevFlow.Application.Features.Auth.Login;

public sealed class LoginCommandValidator : AbstractValidator<LoginCommand>
{
    public LoginCommandValidator()
    {
        // Bounded by the column width rather than validated as an address:
        // this is a username, and registration is what constrains its shape.
        RuleFor(command => command.Username)
            .NotEmpty()
            .MaximumLength(50);

        RuleFor(command => command.Password)
            .NotEmpty();
    }
}
