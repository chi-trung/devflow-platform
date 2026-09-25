using FluentValidation;

namespace DevFlow.Application.Features.Auth.ResendVerification;

public sealed class ResendVerificationCommandValidator : AbstractValidator<ResendVerificationCommand>
{
    public ResendVerificationCommandValidator()
    {
        RuleFor(command => command.Email)
            .NotEmpty()
            .MaximumLength(255)
            .EmailAddress();
    }
}
